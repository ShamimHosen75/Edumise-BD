"use server";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { checkMarkRow, isEntered } from "@/lib/marks";
import { marksEntries } from "@/lib/marks-data";
import { createClient } from "@/lib/supabase/server";
import { assertId } from "@/lib/validation/ids";
import { marksSaveSchema } from "@/lib/validation/marks";

export type SaveMarksResult =
  | { ok: true; saved: number; problems: number[] }
  | { ok: false; error: TranslationKey };

async function staff(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  return requireRole(lang, ["super_admin", "admin", "teacher"]);
}

/**
 * Saves (autosave or import) marks for one subject and section. Rows with a mark
 * outside 0 to full marks are not saved and come back in `problems`; rows left empty
 * remove any saved mark. The database decides who may write and checks the limits too.
 */
export async function saveMarks(
  lang: string,
  input: unknown,
): Promise<SaveMarksResult> {
  const me = await staff(lang);
  const parsed = marksSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "contentAdmin.failed" };
  const { exam_subject_id, section_id, rows } = parsed.data;
  const db = await createClient();
  const { data: es } = await db
    .from("exam_subjects")
    .select("exam_id, cq_full, mcq_full, practical_full")
    .eq("id", exam_subject_id)
    .maybeSingle();
  if (!es) return { ok: false, error: "errors.notAllowed" };
  const entries = await marksEntries(db, me, es.exam_id, lang as "en" | "bn");
  if (!entries.some((e) => e.key === `${exam_subject_id}-${section_id}`))
    return { ok: false, error: "errors.notAllowed" };

  const problems = rows
    .filter((r) => Object.keys(checkMarkRow(r, es)).length > 0)
    .map((r) => r.student_id);
  const good = rows.filter((r) => !problems.includes(r.student_id));
  const filled = good.filter(isEntered);
  const cleared = good.filter((r) => !isEntered(r)).map((r) => r.student_id);
  if (filled.length) {
    const { error } = await db.from("marks").upsert(
      filled.map((r) => ({
        exam_subject_id,
        student_id: r.student_id,
        cq: r.is_absent ? null : r.cq,
        mcq: r.is_absent ? null : r.mcq,
        practical: r.is_absent ? null : r.practical,
        is_absent: r.is_absent,
        entered_by: me.id,
      })),
      { onConflict: "exam_subject_id,student_id" },
    );
    if (error?.code === "42501")
      return { ok: false, error: "errors.marksLocked" };
    if (error) return { ok: false, error: "auth.unexpected" };
  }
  if (cleared.length) {
    const { error } = await db
      .from("marks")
      .delete()
      .eq("exam_subject_id", exam_subject_id)
      .in("student_id", cleared);
    if (error) return { ok: false, error: "auth.unexpected" };
  }
  return { ok: true, saved: filled.length + cleared.length, problems };
}

/** "Submit & lock" for one subject and section. */
export async function submitMarks(
  lang: string,
  examSubjectId: number,
  sectionId: number,
): Promise<{ ok: true } | { ok: false; error: TranslationKey }> {
  assertId(examSubjectId);
  assertId(sectionId);
  await staff(lang);
  const db = await createClient();
  const { error } = await db.rpc("submit_marks", {
    p_exam_subject_id: examSubjectId,
    p_section_id: sectionId,
  });
  if (error?.code === "23514")
    return { ok: false, error: "errors.marksMissing" };
  if (error?.code === "22023")
    return { ok: false, error: "errors.marksClosed" };
  if (error) return { ok: false, error: "errors.notAllowed" };
  return { ok: true };
}
