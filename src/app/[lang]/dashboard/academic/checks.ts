import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcademicEntity } from "@/lib/academic";
import type { ActionResult } from "@/lib/actions";
import { classUsesGroups } from "@/lib/validation/academic";

type Failure = Extract<ActionResult, { ok: false }>;

/**
 * Rules a single row cannot check by itself. Returns a failure, or null to go on.
 * The row is already validated by the entity's Zod schema.
 */
export async function checkAcademicSave(
  db: SupabaseClient,
  entity: AcademicEntity,
  id: number | null,
  row: Record<string, unknown>,
): Promise<Failure | null> {
  if (entity === "classes" && id !== null) {
    // Classes 9-10 have subjects per group, 6-8 do not: a level change across that line
    // would leave the class's subject list unusable.
    const { data: cls } = await db
      .from("classes")
      .select("level")
      .eq("id", id)
      .maybeSingle();
    const to = Number(row.level);
    if (cls && classUsesGroups(cls.level) !== classUsesGroups(to)) {
      const { count } = await db
        .from("class_subjects")
        .select("id", { count: "exact", head: true })
        .eq("class_id", id);
      if (count)
        return {
          ok: false,
          error: "errors.levelInUse",
          fieldErrors: { level: "errors.levelInUse" },
        };
    }
  }
  if (entity === "exam-subjects") {
    const examId = Number(row.exam_id);
    // Published results are a snapshot of these settings: no changes after publishing.
    const { data: exam } = await db
      .from("exams")
      .select("status")
      .eq("id", examId)
      .maybeSingle();
    if (exam?.status === "published")
      return { ok: false, error: "errors.examPublished" };
    if (id !== null) {
      const { data: current } = await db
        .from("exam_subjects")
        .select("exam_id, class_id, subject_id")
        .eq("id", id)
        .maybeSingle();
      // Marks belong to this exam, class and subject: only the marks setup can change.
      if (
        !current ||
        current.exam_id !== examId ||
        current.class_id !== Number(row.class_id) ||
        current.subject_id !== Number(row.subject_id)
      )
        return { ok: false, error: "errors.notAllowed" };
      // Saved marks must still fit the full marks (the database refuses it too).
      const { count: above } = await db
        .from("marks")
        .select("id", { count: "exact", head: true })
        .eq("exam_subject_id", id)
        .or(
          `cq.gt.${Number(row.cq_full)},mcq.gt.${Number(row.mcq_full)},practical.gt.${Number(row.practical_full)}`,
        );
      if (above) return { ok: false, error: "errors.belowSavedMarks" };
    }
    const [{ count: sits }, { count: taught }] = await Promise.all([
      db
        .from("exam_classes")
        .select("class_id", { count: "exact", head: true })
        .eq("exam_id", examId)
        .eq("class_id", Number(row.class_id)),
      db
        .from("class_subjects")
        .select("id", { count: "exact", head: true })
        .eq("class_id", Number(row.class_id))
        .eq("subject_id", Number(row.subject_id)),
    ]);
    if (!sits)
      return {
        ok: false,
        error: "errors.examClass",
        fieldErrors: { class_id: "errors.examClass" },
      };
    if (!taught)
      return {
        ok: false,
        error: "errors.notTaught",
        fieldErrors: { subject_id: "errors.notTaught" },
      };
  }
  if (entity === "exam-schedule") {
    const examId = Number(row.exam_id);
    if (id !== null) {
      // A paper stays in its exam (the exam id comes from the browser).
      const { data: current } = await db
        .from("exam_schedule")
        .select("exam_id")
        .eq("id", id)
        .maybeSingle();
      if (!current || current.exam_id !== examId)
        return { ok: false, error: "errors.notAllowed" };
    }
    const [{ data: exam }, { count: taught }] = await Promise.all([
      db
        .from("exams")
        .select("starts_on, ends_on, exam_classes(class_id)")
        .eq("id", examId)
        .maybeSingle(),
      db
        .from("class_subjects")
        .select("id", { count: "exact", head: true })
        .eq("class_id", Number(row.class_id))
        .eq("subject_id", Number(row.subject_id)),
    ]);
    if (!exam) return { ok: false, error: "errors.notAllowed" };
    const classes = (exam.exam_classes as { class_id: number }[]).map(
      (c) => c.class_id,
    );
    if (classes.length && !classes.includes(Number(row.class_id)))
      return {
        ok: false,
        error: "errors.examClass",
        fieldErrors: { class_id: "errors.examClass" },
      };
    if (!taught)
      return {
        ok: false,
        error: "errors.notTaught",
        fieldErrors: { subject_id: "errors.notTaught" },
      };
    const date = String(row.exam_date);
    if (
      (exam.starts_on && date < exam.starts_on) ||
      (exam.ends_on && date > exam.ends_on)
    )
      return {
        ok: false,
        error: "errors.examDate",
        fieldErrors: { exam_date: "errors.examDate" },
      };
  }
  return null;
}
