"use server";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { dbError, invalid, requireAdmin } from "@/lib/actions";
import { findClashes, invalidCells, type Clash } from "@/lib/routine";
import { routineEntries, routineFrame } from "@/lib/routine-data";
import { TAGS } from "@/lib/site/cache";
import { assertId } from "@/lib/validation/ids";
import { routineSaveSchema } from "@/lib/validation/routine";

export type SaveRoutineResult =
  | { ok: true }
  | {
      ok: false;
      error: TranslationKey;
      clashes?: Clash[];
      fieldErrors?: Record<string, TranslationKey>;
    };

/**
 * Saves one section's week. Checked here first (closed days, breaks, teacher and room
 * clashes with other sections) so the admin sees which classes clash; the database
 * checks clashes again in the same transaction.
 */
export async function saveRoutine(
  lang: string,
  input: unknown,
): Promise<SaveRoutineResult> {
  const db = await requireAdmin(lang);
  if (!isLocale(lang)) throw new Error("Invalid language");
  const parsed = routineSaveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as SaveRoutineResult;
  const { session_id, section_id, cells } = parsed.data;
  const { periods, workingDays } = await routineFrame(db);
  const bad = invalidCells(cells, {
    workingDays,
    breakPeriodIds: periods.filter((p) => p.is_break).map((p) => p.id),
  });
  if (
    bad.length ||
    cells.some((c) => !periods.some((p) => p.id === c.periodId))
  )
    return { ok: false, error: "errors.routineCells" };
  const others = await routineEntries(db, session_id, lang);
  const clashes = findClashes(cells, others, section_id);
  if (clashes.length) return { ok: false, error: "errors.clash", clashes };

  const { error } = await db.rpc("save_section_routine", {
    p_session_id: session_id,
    p_section_id: section_id,
    p_cells: cells.map((c) => ({
      day_of_week: c.day,
      period_id: c.periodId,
      subject_id: c.subjectId,
      staff_id: c.staffId,
      room_id: c.roomId,
    })),
  });
  // Someone else saved a clashing class a moment ago.
  if (error?.code === "23505") return { ok: false, error: "errors.clash" };
  if (error?.code === "22023")
    return { ok: false, error: "errors.routineCells" };
  if (error) return dbError(error) as SaveRoutineResult;
  revalidateTag(TAGS.routine);
  return { ok: true };
}

/** Shows or hides an exam's schedule on the website. */
export async function setSchedulePublished(
  lang: string,
  examId: number,
  published: boolean,
): Promise<{ ok: true } | { ok: false; error: TranslationKey }> {
  assertId(examId);
  if (typeof published !== "boolean") throw new Error("Invalid request");
  const db = await requireAdmin(lang);
  const { data, error } = await db
    .from("exams")
    .update({ schedule_published: published })
    .eq("id", examId)
    .select("id");
  if (error || !data.length) return { ok: false, error: "errors.notAllowed" };
  revalidateTag(TAGS.routine);
  return { ok: true };
}
