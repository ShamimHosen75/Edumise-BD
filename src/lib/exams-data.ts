import "server-only";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import { isComplete, takesSubject } from "@/lib/marks";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type ExamRow = {
  id: number;
  name_en: string;
  name_bn: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: "draft" | "marks_entry" | "review" | "published";
  classIds: number[];
  classes: string;
};

/** Exams of the current session, by start date. */
export async function sessionExams(
  db: Client,
  lang: Locale,
): Promise<ExamRow[]> {
  const { data, error } = await db
    .from("exams")
    .select(
      "id, name_en, name_bn, starts_on, ends_on, status, session:academic_sessions!inner(is_current), exam_classes(class:classes(id, level, name_en, name_bn))",
    )
    .eq("session.is_current", true)
    .order("starts_on", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => {
    const classes = (
      e.exam_classes as unknown as {
        class: Named & { id: number; level: number };
      }[]
    )
      .map((c) => c.class)
      .sort((a, b) => a.level - b.level);
    return {
      id: e.id,
      name_en: e.name_en,
      name_bn: e.name_bn,
      name: pickLocalized(e, "name", lang),
      starts_on: e.starts_on,
      ends_on: e.ends_on,
      status: e.status,
      classIds: classes.map((c) => c.id),
      classes: classes.map((c) => pickLocalized(c, "name", lang)).join(", "),
    };
  });
}

export type ExamSubjectRow = {
  id: number;
  exam_id: number;
  class_id: number;
  subject_id: number;
  cq_full: number;
  cq_pass: number | null;
  mcq_full: number;
  mcq_pass: number | null;
  practical_full: number;
  practical_pass: number | null;
  full_marks: number;
  counts_in_gpa: boolean;
  className: string;
  level: number;
  subject: string;
  sortOrder: number;
};

export async function examSubjects(
  db: Client,
  examId: number,
  lang: Locale,
): Promise<ExamSubjectRow[]> {
  const { data, error } = await db
    .from("exam_subjects")
    .select(
      "id, exam_id, class_id, subject_id, cq_full, cq_pass, mcq_full, mcq_pass, practical_full, practical_pass, full_marks, counts_in_gpa, class:classes(level, name_en, name_bn), subject:subjects(name_en, name_bn, sort_order)",
    )
    .eq("exam_id", examId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(({ class: c, subject: s, ...r }) => {
      const cls = c as unknown as Named & { level: number };
      const sub = s as unknown as Named & { sort_order: number };
      return {
        ...r,
        full_marks: r.full_marks ?? r.cq_full + r.mcq_full + r.practical_full,
        className: pickLocalized(cls, "name", lang),
        level: cls.level,
        subject: pickLocalized(sub, "name", lang),
        sortOrder: sub.sort_order,
      };
    })
    .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);
}

export type CompletionRow = {
  key: string;
  examSubjectId: number;
  sectionId: number;
  section: string;
  subject: string;
  level: number;
  sortOrder: number;
  students: number;
  entered: number;
  lockedAt: string | null;
};

/** For each subject and section of the exam: students, marks entered, submitted or not. */
export async function examCompletion(
  db: Client,
  examId: number,
  lang: Locale,
): Promise<CompletionRow[]> {
  const subjects = await examSubjects(db, examId, lang);
  if (!subjects.length) return [];
  const { data: exam } = await db
    .from("exams")
    .select("session_id")
    .eq("id", examId)
    .single();
  const ids = subjects.map((s) => s.id);
  const classIds = [...new Set(subjects.map((s) => s.class_id))];
  const [
    { data: sections },
    { data: taught },
    enrolled,
    marks,
    { data: locks },
  ] = await Promise.all([
    db
      .from("sections")
      .select("id, class_id, name_en, name_bn")
      .in("class_id", classIds),
    db
      .from("class_subjects")
      .select("class_id, subject_id, group_id")
      .in("class_id", classIds),
    // Students still at school (as on the marks page and in "Submit & lock").
    fetchAll((a, b) =>
      db
        .from("enrollments")
        .select(
          "student_id, section_id, group_id, student:students!inner(status)",
        )
        .eq("session_id", exam!.session_id)
        .not("student.status", "in", "(transferred,inactive)")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("marks")
        .select("exam_subject_id, student_id, cq, mcq, practical, is_absent")
        .in("exam_subject_id", ids)
        .order("id")
        .range(a, b),
    ),
    db
      .from("mark_locks")
      .select("exam_subject_id, section_id, locked_at")
      .in("exam_subject_id", ids),
  ]);
  const lockAt = new Map(
    (locks ?? []).map((l) => [
      `${l.exam_subject_id}:${l.section_id}`,
      l.locked_at,
    ]),
  );
  const markOf = new Map(
    marks.map((m) => [`${m.exam_subject_id}:${m.student_id}`, m]),
  );
  const count = new Map<string, number>();
  const entered = new Map<string, number>();
  for (const s of subjects) {
    const groups = (taught ?? [])
      .filter((t) => t.class_id === s.class_id && t.subject_id === s.subject_id)
      .map((t) => t.group_id);
    for (const e of enrolled) {
      if (!takesSubject(groups, e.group_id)) continue;
      const key = `${s.id}:${e.section_id}`;
      count.set(key, (count.get(key) ?? 0) + 1);
      const m = markOf.get(`${s.id}:${e.student_id}`);
      if (m && isComplete(m, s)) entered.set(key, (entered.get(key) ?? 0) + 1);
    }
  }
  return subjects.flatMap((s) =>
    (sections ?? [])
      // Sections where nobody takes the subject (another group's subject) are left out.
      .filter(
        (sec) => sec.class_id === s.class_id && count.get(`${s.id}:${sec.id}`),
      )
      .map((sec) => {
        const key = `${s.id}:${sec.id}`;
        return {
          key,
          examSubjectId: s.id,
          sectionId: sec.id,
          section: `${s.className} ${pickLocalized(sec, "name", lang)}`,
          subject: s.subject,
          level: s.level,
          sortOrder: s.sortOrder,
          students: count.get(key) ?? 0,
          entered: entered.get(key) ?? 0,
          lockedAt: lockAt.get(key) ?? null,
        };
      }),
  );
}
