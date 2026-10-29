"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { TAGS } from "@/lib/site/cache";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import { EXAM_STATUSES, examSchema } from "@/lib/validation/marks";

// The public exam routine and result search list exams by name.
const refresh = () => {
  revalidateTag(TAGS.routine);
  revalidateTag(TAGS.results);
};

/** Creates (in the current session) or updates an exam and the classes that sit it. */
export async function saveExam(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  const db = await requireAdmin(lang);
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { class_ids, ...v } = parsed.data;
  const row = {
    ...v,
    starts_on: v.starts_on || null,
    ends_on: v.ends_on || null,
  };
  let examId = id;
  if (id === null) {
    const { data: session } = await db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    if (!session) return { ok: false, error: "errors.notAllowed" };
    const { data, error } = await db
      .from("exams")
      .insert({ ...row, session_id: session.id })
      .select("id")
      .single();
    if (error) return dbError(error, "name_en");
    examId = data.id;
  } else {
    const { data, error } = await db
      .from("exams")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) return dbError(error, "name_en");
    if (!data.length) return { ok: false, error: "errors.notAllowed" };
  }
  // Classes: a class that already has exam subjects stays (its marks belong to it).
  const { data: current } = await db
    .from("exam_classes")
    .select("class_id")
    .eq("exam_id", examId!);
  const have = new Set((current ?? []).map((c) => c.class_id));
  const removed = [...have].filter((c) => !class_ids.includes(c));
  if (removed.length) {
    const { count } = await db
      .from("exam_subjects")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId!)
      .in("class_id", removed);
    if (count)
      return {
        ok: false,
        error: "errors.inUse",
        fieldErrors: { class_ids: "errors.inUse" },
      };
    await db
      .from("exam_classes")
      .delete()
      .eq("exam_id", examId!)
      .in("class_id", removed);
  }
  const added = class_ids.filter((c) => !have.has(c));
  if (added.length) {
    const { error } = await db
      .from("exam_classes")
      .insert(added.map((class_id) => ({ exam_id: examId!, class_id })));
    if (error) return dbError(error);
  }
  refresh();
  return { ok: true, id: examId! };
}

export async function deleteExam(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const db = await requireAdmin(lang);
  const { data, error } = await db
    .from("exams")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  refresh();
  return { ok: true };
}

/** Moves an exam to another status; publishing records when it happened. */
export async function setExamStatus(
  lang: string,
  id: number,
  status: unknown,
): Promise<ActionResult> {
  assertId(id);
  const parsed = z.enum(EXAM_STATUSES).safeParse(status);
  if (!parsed.success) throw new Error("Invalid request");
  const db = await requireAdmin(lang);
  const { data: exam } = await db
    .from("exams")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!exam) return { ok: false, error: "errors.notAllowed" };
  const { error } = await db
    .from("exams")
    .update({
      status: parsed.data,
      published_at:
        parsed.data === "published"
          ? (exam.published_at ?? new Date().toISOString())
          : exam.published_at,
    })
    .eq("id", id);
  // 23514: the database refuses to publish without up-to-date results.
  if (error)
    return error.code === "23514"
      ? { ok: false, error: "results.notCurrent" }
      : dbError(error);
  await db.rpc("record_audit", {
    p_action: "exam.status",
    p_entity: "exam",
    p_entity_id: String(id),
    p_details: { status: parsed.data },
  });
  refresh();
  return { ok: true };
}

/**
 * Adds every subject taught in a class (all groups) that the exam does not have yet,
 * with common BD marks: CQ 70 (pass 23), MCQ 30 (pass 10).
 */
export async function addClassSubjects(
  lang: string,
  examId: number,
  classId: number,
): Promise<
  | { ok: true; count: number }
  | { ok: false; error: "errors.notAllowed" | "auth.unexpected" }
> {
  assertId(examId);
  assertId(classId);
  const db = await requireAdmin(lang);
  const [{ data: sits }, { data: taught }, { data: have }] = await Promise.all([
    db
      .from("exam_classes")
      .select("class_id")
      .eq("exam_id", examId)
      .eq("class_id", classId),
    db
      .from("class_subjects")
      .select("subject_id, subject:subjects(type)")
      .eq("class_id", classId),
    db
      .from("exam_subjects")
      .select("subject_id")
      .eq("exam_id", examId)
      .eq("class_id", classId),
  ]);
  if (!sits?.length) return { ok: false, error: "errors.notAllowed" };
  const existing = new Set((have ?? []).map((h) => h.subject_id));
  const rows = [
    ...new Map(
      (taught ?? [])
        .filter((t) => !existing.has(t.subject_id))
        .map((t) => [t.subject_id, t]),
    ).values(),
  ].map((t) => ({
    exam_id: examId,
    class_id: classId,
    subject_id: t.subject_id,
    cq_full: 70,
    cq_pass: 23,
    mcq_full: 30,
    mcq_pass: 10,
    practical_full: 0,
    // Optional subjects do not count unless the office says so (open question 31).
    counts_in_gpa:
      (t.subject as unknown as { type: string }).type !== "optional",
  }));
  if (rows.length) {
    const { error } = await db.from("exam_subjects").insert(rows);
    if (error) return { ok: false, error: "auth.unexpected" };
  }
  return { ok: true, count: rows.length };
}

/** Reopens a submitted subject for one section. */
export async function unlockMarks(
  lang: string,
  examSubjectId: number,
  sectionId: number,
): Promise<ActionResult> {
  assertId(examSubjectId);
  assertId(sectionId);
  const db = await requireAdmin(lang);
  const { data, error } = await db.rpc("unlock_marks", {
    p_exam_subject_id: examSubjectId,
    p_section_id: sectionId,
  });
  if (error) return dbError(error);
  return data ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}
