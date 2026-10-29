import "server-only";

import { schoolDays, summarize, type Holiday } from "@/lib/attendance";
import { parseScale } from "@/lib/grading";
import type { MarkRow } from "@/lib/marks";
import { dhakaToday } from "@/lib/people";
import type { BuildInput, NamedPaper, Sitting } from "@/lib/results-build";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Marks = Omit<MarkRow, "student_id">;

/** Everything buildResults() needs for one exam (admin client: RLS lets admins read it). */
export async function loadExamInput(
  db: Client,
  examId: number,
): Promise<(BuildInput & { status: string }) | null> {
  const { data: exam } = await db
    .from("exams")
    .select(
      "id, status, ends_on, session:academic_sessions(id, starts_on, ends_on), exam_classes(class_id)",
    )
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return null;
  const session = exam.session as unknown as {
    id: number;
    starts_on: string;
    ends_on: string;
  };
  const classIds = (exam.exam_classes as { class_id: number }[]).map(
    (c) => c.class_id,
  );
  const [
    { data: settings },
    { data: subjects },
    { data: taught },
    { data: sections },
    { data: holidays },
  ] = await Promise.all([
    db.from("school_settings").select("grading, working_days").maybeSingle(),
    db
      .from("exam_subjects")
      .select(
        "id, class_id, subject_id, cq_full, cq_pass, mcq_full, mcq_pass, practical_full, practical_pass, counts_in_gpa, subject:subjects(type, paper_group, sort_order, name_en, name_bn)",
      )
      .eq("exam_id", examId),
    db
      .from("class_subjects")
      .select("class_id, group_id, subject_id")
      .in("class_id", classIds),
    db
      .from("sections")
      .select("id, class_id, name_en")
      .in("class_id", classIds)
      .order("name_en"),
    db.from("holidays").select("starts_on, ends_on"),
  ]);
  const papers: NamedPaper[] = (subjects ?? []).map((es) => {
    const s = es.subject as unknown as {
      type: "compulsory" | "optional" | "fourth";
      paper_group: string | null;
      sort_order: number;
      name_en: string;
      name_bn: string;
    };
    return {
      examSubjectId: es.id,
      classId: es.class_id,
      subjectId: es.subject_id,
      cq_full: es.cq_full,
      mcq_full: es.mcq_full,
      practical_full: es.practical_full,
      cq_pass: es.cq_pass,
      mcq_pass: es.mcq_pass,
      practical_pass: es.practical_pass,
      countsInGpa: es.counts_in_gpa,
      subjectType: s.type,
      paperGroup: s.paper_group,
      sortOrder: s.sort_order,
      name_en: s.name_en,
      name_bn: s.name_bn,
      groupIds: (taught ?? [])
        .filter(
          (t) => t.class_id === es.class_id && t.subject_id === es.subject_id,
        )
        .map((t) => t.group_id),
    };
  });
  const sectionList = sections ?? [];
  const sectionIds = sectionList.map((s) => s.id);
  const order = (id: number) => {
    const s = sectionList.find((x) => x.id === id)!;
    return sectionList.filter((x) => x.class_id === s.class_id).indexOf(s) + 1;
  };
  const enrolled = sectionIds.length
    ? await fetchAll((a, b) =>
        db
          .from("enrollments")
          .select("student_id, section_id, roll, group_id, fourth_subject_id")
          .eq("session_id", session.id)
          .in("section_id", sectionIds)
          .order("id")
          .range(a, b),
      )
    : [];
  const students: Sitting[] = enrolled.map((e) => ({
    studentId: e.student_id,
    classId: sectionList.find((s) => s.id === e.section_id)!.class_id,
    sectionId: e.section_id,
    sectionOrder: order(e.section_id),
    roll: e.roll,
    groupId: e.group_id,
    fourthSubjectId: e.fourth_subject_id,
  }));
  const ids = papers.map((p) => p.examSubjectId);
  const markRows = ids.length
    ? await fetchAll((a, b) =>
        db
          .from("marks")
          .select("exam_subject_id, student_id, cq, mcq, practical, is_absent")
          .in("exam_subject_id", ids)
          .order("id")
          .range(a, b),
      )
    : [];
  const marks = new Map<number, Map<number, Marks>>();
  for (const m of markRows) {
    const per = marks.get(m.student_id) ?? new Map<number, Marks>();
    per.set(m.exam_subject_id, {
      cq: m.cq,
      mcq: m.mcq,
      practical: m.practical,
      is_absent: m.is_absent,
    });
    marks.set(m.student_id, per);
  }
  // Attendance from the start of the session to the end of the exam (or today).
  const today = dhakaToday();
  const end = [exam.ends_on ?? today, today, session.ends_on].sort()[0]!;
  const days = schoolDays(
    session.starts_on,
    end,
    settings?.working_days ?? [6, 0, 1, 2, 3, 4],
    (holidays ?? []).map((h): Holiday => ({
      start: h.starts_on,
      end: h.ends_on,
    })),
  );
  const att = enrolled.length
    ? await fetchAll((a, b) =>
        db
          .from("attendance")
          .select("student_id, date, status")
          .in("section_id", sectionIds)
          .gte("date", session.starts_on)
          .lte("date", end)
          .order("id")
          .range(a, b),
      )
    : [];
  const byStudent = new Map<
    number,
    { date: string; status: (typeof att)[number]["status"] }[]
  >();
  for (const a of att)
    byStudent.set(a.student_id, [...(byStudent.get(a.student_id) ?? []), a]);
  const attendance = new Map(
    students.map((s) => [
      s.studentId,
      summarize(byStudent.get(s.studentId) ?? [], days).percent,
    ]),
  );
  return {
    status: exam.status,
    scale: parseScale(settings?.grading),
    papers,
    students,
    marks,
    attendance,
  };
}
