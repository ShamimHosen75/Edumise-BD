import "server-only";

import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import {
  subjectSnapshotSchema,
  type SubjectSnapshot,
} from "@/lib/validation/results";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A mark sheet, in the shape lookup_result() returns (both languages). */
export type MarkSheet = {
  exam_en: string;
  exam_bn: string;
  session: string;
  name_en: string;
  name_bn: string;
  class_en: string;
  class_bn: string;
  section_en: string;
  section_bn: string;
  group_en: string | null;
  group_bn: string | null;
  roll: number;
  total: number;
  full_total: number;
  gpa: number;
  gpa_without_fourth: number;
  grade: string;
  passed: boolean;
  failed_count: number;
  section_position: number;
  class_position: number;
  attendance_percent: number | null;
  subjects: SubjectSnapshot[];
  published_at: string | null;
};

const snapshots = (json: unknown) => subjectSnapshotSchema.array().parse(json);

const RESULT_SELECT =
  "id, exam_id, student_id, roll, total, full_total, gpa, gpa_without_fourth, grade, passed, failed_count, section_position, class_position, attendance_percent, subjects, section:sections(id, name_en, name_bn, class:classes(level, name_en, name_bn)), grp:groups(name_en, name_bn), student:students(student_code, full_name_en, full_name_bn, photo_path), exam:exams(name_en, name_bn, status, published_at, session:academic_sessions(name))";

type Raw = {
  id: number;
  exam_id: number;
  student_id: number;
  roll: number;
  total: number;
  full_total: number;
  gpa: number;
  gpa_without_fourth: number;
  grade: string;
  passed: boolean;
  failed_count: number;
  section_position: number;
  class_position: number;
  attendance_percent: number | null;
  subjects: unknown;
  section: {
    id: number;
    name_en: string;
    name_bn: string;
    class: { level: number; name_en: string; name_bn: string };
  };
  grp: { name_en: string; name_bn: string } | null;
  student: {
    student_code: string;
    full_name_en: string;
    full_name_bn: string;
    photo_path: string | null;
  };
  exam: {
    name_en: string;
    name_bn: string;
    status: string;
    published_at: string | null;
    session: { name: string };
  };
};

export type ResultRecord = MarkSheet & {
  id: number;
  examId: number;
  studentId: number;
  sectionId: number;
  level: number;
  studentCode: string;
  photoPath: string | null;
  examStatus: string;
};

function toRecord(r: Raw): ResultRecord {
  return {
    id: r.id,
    examId: r.exam_id,
    studentId: r.student_id,
    sectionId: r.section.id,
    level: r.section.class.level,
    studentCode: r.student.student_code,
    photoPath: r.student.photo_path,
    examStatus: r.exam.status,
    exam_en: r.exam.name_en,
    exam_bn: r.exam.name_bn,
    session: r.exam.session.name,
    name_en: r.student.full_name_en,
    name_bn: r.student.full_name_bn,
    class_en: r.section.class.name_en,
    class_bn: r.section.class.name_bn,
    section_en: r.section.name_en,
    section_bn: r.section.name_bn,
    group_en: r.grp?.name_en ?? null,
    group_bn: r.grp?.name_bn ?? null,
    roll: r.roll,
    total: Number(r.total),
    full_total: r.full_total,
    gpa: Number(r.gpa),
    gpa_without_fourth: Number(r.gpa_without_fourth),
    grade: r.grade,
    passed: r.passed,
    failed_count: r.failed_count,
    section_position: r.section_position,
    class_position: r.class_position,
    attendance_percent:
      r.attendance_percent === null ? null : Number(r.attendance_percent),
    subjects: snapshots(r.subjects),
    published_at: r.exam.published_at,
  };
}

/** Results of an exam (RLS decides who sees which), by section then position. */
export async function examResults(
  db: Client,
  examId: number,
  sectionId?: number,
): Promise<ResultRecord[]> {
  const rows = await fetchAll((a, b) => {
    let q = db.from("results").select(RESULT_SELECT).eq("exam_id", examId);
    if (sectionId) q = q.eq("section_id", sectionId);
    return q.order("id").range(a, b);
  });
  return (rows as unknown as Raw[])
    .map(toRecord)
    .sort(
      (a, b) =>
        a.level - b.level ||
        a.section_en.localeCompare(b.section_en) ||
        a.section_position - b.section_position,
    );
}

/** One student's results, newest exam first (RLS: published only for the family). */
export async function studentResults(
  db: Client,
  studentId: number,
): Promise<ResultRecord[]> {
  const { data, error } = await db
    .from("results")
    .select(RESULT_SELECT)
    .eq("student_id", studentId)
    .order("exam_id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Raw[]).map(toRecord);
}

/** Parses lookup_result() output (null when nothing matched). */
export function readMarkSheet(json: unknown): MarkSheet | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  const num = (v: unknown) => Number(v);
  return {
    ...(r as unknown as MarkSheet),
    roll: num(r.roll),
    total: num(r.total),
    gpa: num(r.gpa),
    gpa_without_fourth: num(r.gpa_without_fourth),
    attendance_percent:
      r.attendance_percent === null ? null : num(r.attendance_percent),
    subjects: snapshots(r.subjects),
  };
}

/** When results were last processed and whether marks changed since then. */
export async function resultsState(db: Client, examId: number) {
  const [{ data: exam }, { data: mark }, { data: subject }] = await Promise.all(
    [
      db
        .from("exams")
        .select("results_processed_at")
        .eq("id", examId)
        .maybeSingle(),
      db
        .from("marks")
        .select("updated_at, exam_subject:exam_subjects!inner(exam_id)")
        .eq("exam_subject.exam_id", examId)
        .order("updated_at", { ascending: false })
        .limit(1),
      db
        .from("exam_subjects")
        .select("updated_at")
        .eq("exam_id", examId)
        .order("updated_at", { ascending: false })
        .limit(1),
    ],
  );
  const processedAt = exam?.results_processed_at ?? null;
  const latest = [mark?.[0]?.updated_at, subject?.[0]?.updated_at]
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime());
  return {
    processedAt,
    current:
      processedAt !== null &&
      latest.every((t) => t <= new Date(processedAt).getTime()),
  };
}
