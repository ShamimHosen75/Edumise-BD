// Builds an exam's result rows from loaded data (pure, unit tested). The grading rules
// themselves are in grading.ts.

import {
  gradeSubject,
  rankResults,
  studentResult,
  type Band,
} from "@/lib/grading";
import {
  needsFourthChoice,
  studentSubjects,
  type ExamPaper,
} from "@/lib/grading-subjects";
import { isComplete, type MarkRow } from "@/lib/marks";
import type { ResultRow, SubjectSnapshot } from "@/lib/validation/results";

export type NamedPaper = ExamPaper & {
  classId: number;
  name_en: string;
  name_bn: string;
};

export type Sitting = {
  studentId: number;
  classId: number;
  sectionId: number;
  /** The section's place in its class (A = 1), to break equal rolls. */
  sectionOrder: number;
  roll: number;
  groupId: number | null;
  fourthSubjectId: number | null;
};

type Marks = Omit<MarkRow, "student_id">;

export type BuildInput = {
  scale: readonly Band[];
  papers: readonly NamedPaper[];
  students: readonly Sitting[];
  /** student id -> exam subject id -> marks */
  marks: ReadonlyMap<number, ReadonlyMap<number, Marks>>;
  attendance: ReadonlyMap<number, number | null>;
};

export type Missing = { studentId: number; examSubjectId: number };

export function buildResults(input: BuildInput): {
  rows: ResultRow[];
  missing: Missing[];
  /** Students with several fourth-type subjects and none chosen on the enrolment. */
  needsFourth: number[];
} {
  const missing: Missing[] = [];
  const needsFourth: number[] = [];
  const graded = input.students.flatMap((st) => {
    const papers = input.papers.filter((p) => p.classId === st.classId);
    const marks = input.marks.get(st.studentId) ?? new Map<number, Marks>();
    const subjects = studentSubjects(papers, st, marks);
    if (!subjects.length) return [];
    if (needsFourthChoice(papers, st)) needsFourth.push(st.studentId);
    const grades = subjects.map((s) => gradeSubject(s, input.scale));
    for (const s of subjects)
      for (const p of s.papers)
        if (
          !marks.has(p.examSubjectId) ||
          !isComplete(marks.get(p.examSubjectId)!, p)
        )
          missing.push({
            studentId: st.studentId,
            examSubjectId: p.examSubjectId,
          });
    const snapshot: SubjectSnapshot[] = subjects.map((s, i) => {
      const g = grades[i]!;
      const named = s.papers.map((p) =>
        papers.find((x) => x.examSubjectId === p.examSubjectId)!,
      );
      return {
        key: s.key,
        name_en: named.map((n) => n.name_en).join(" + "),
        name_bn: named.map((n) => n.name_bn || n.name_en).join(" + "),
        role: s.role,
        papers: s.papers.map((p, j) => ({
          name_en: named[j]!.name_en,
          name_bn: named[j]!.name_bn,
          full: p.cq_full + p.mcq_full + p.practical_full,
          cq: p.mark?.cq ?? null,
          mcq: p.mark?.mcq ?? null,
          practical: p.mark?.practical ?? null,
          absent: p.mark?.is_absent ?? false,
        })),
        obtained: g.obtained,
        full: g.full,
        percent: Math.min(100, g.percent),
        grade: g.grade,
        point: g.point,
        failed: g.failed,
        absent: g.absent,
        failed_parts: g.failedParts,
      };
    });
    return [{ st, result: studentResult(grades, input.scale), snapshot }];
  });

  const rank = (key: (g: (typeof graded)[number]) => number) => {
    const positions = new Map<number, number>();
    for (const groupKey of new Set(graded.map(key))) {
      const ranked = rankResults(
        graded
          .filter((g) => key(g) === groupKey)
          .map((g) => ({
            id: g.st.studentId,
            passed: g.result.passed,
            gpa: g.result.gpa,
            total: g.result.total,
            roll: g.st.roll,
            sectionOrder: g.st.sectionOrder,
          })),
      );
      for (const [id, pos] of ranked) positions.set(id, pos);
    }
    return positions;
  };
  const bySection = rank((g) => g.st.sectionId);
  const byClass = rank((g) => g.st.classId);

  return {
    missing,
    needsFourth,
    rows: graded.map(({ st, result, snapshot }) => ({
      student_id: st.studentId,
      total: result.total,
      full_total: result.fullTotal,
      gpa: result.gpa,
      gpa_without_fourth: result.gpaWithoutFourth,
      grade: result.grade,
      passed: result.passed,
      failed_count: result.failedCount,
      section_position: bySection.get(st.studentId)!,
      class_position: byClass.get(st.studentId)!,
      attendance_percent: input.attendance.get(st.studentId) ?? null,
      subjects: snapshot,
    })),
  };
}

/** Summary for the results tab: students, passed, pass rate, GPA 5.00 count. */
export function resultSummary(
  rows: readonly { passed: boolean; gpa: number }[],
) {
  const passed = rows.filter((r) => r.passed).length;
  return {
    students: rows.length,
    passed,
    failed: rows.length - passed,
    passRate: rows.length
      ? Math.round((passed / rows.length) * 1000) / 10
      : null,
    gpa5: rows.filter((r) => r.gpa === 5).length,
  };
}
