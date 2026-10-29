// Which subjects each student sits, and in what role (pure, unit tested).

import type { PaperInput, SubjectInput, SubjectRole } from "@/lib/grading";
import { takesSubject } from "@/lib/marks";

type Marks = NonNullable<PaperInput["mark"]>;

/** An exam subject of the class, as the processor sees it. */
export type ExamPaper = Omit<PaperInput, "mark"> & {
  subjectId: number;
  subjectType: "compulsory" | "optional" | "fourth";
  paperGroup: string | null;
  countsInGpa: boolean;
  /** Groups the subject is taught to in this class (null: every student). */
  groupIds: readonly (number | null)[];
  sortOrder: number;
};

/**
 * The subjects one student sits (those taught to everyone in the class or to the
 * student's group), with roles:
 * - fourth: the subject chosen on the enrolment, or else the only fourth-type subject;
 * - extra: does not count in GPA, or a fourth-type subject when several exist and none
 *   is chosen;
 * - compulsory: everything else. A fourth-type subject that is not the student's choice
 *   is compulsory (e.g. Higher Maths when Biology is the fourth subject).
 */
export function studentSubjects(
  papers: readonly ExamPaper[],
  student: { groupId: number | null; fourthSubjectId: number | null },
  marks: ReadonlyMap<number, Marks>,
): SubjectInput[] {
  const taken = papers
    .filter((p) => takesSubject(p.groupIds, student.groupId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const fourthTyped = taken.filter((p) => p.subjectType === "fourth");
  const fourthId =
    student.fourthSubjectId ??
    (new Set(fourthTyped.map((p) => p.subjectId)).size === 1
      ? fourthTyped[0]!.subjectId
      : null);
  const role = (p: ExamPaper): SubjectRole =>
    p.subjectId === fourthId
      ? "fourth"
      : p.subjectType === "fourth" && student.fourthSubjectId === null
        ? "extra"
        : p.countsInGpa
          ? "compulsory"
          : "extra";
  const byKey = new Map<string, SubjectInput>();
  for (const p of taken) {
    const key = p.paperGroup ? `g:${p.paperGroup}` : `s:${p.subjectId}`;
    const paper: PaperInput = {
      examSubjectId: p.examSubjectId,
      cq_full: p.cq_full,
      mcq_full: p.mcq_full,
      practical_full: p.practical_full,
      cq_pass: p.cq_pass,
      mcq_pass: p.mcq_pass,
      practical_pass: p.practical_pass,
      mark: marks.get(p.examSubjectId) ?? null,
    };
    const have = byKey.get(key);
    if (have) {
      have.papers.push(paper);
      // A group counts as fourth or compulsory if any of its papers does.
      if (have.role === "extra") have.role = role(p);
    } else byKey.set(key, { key, role: role(p), papers: [paper] });
  }
  return [...byKey.values()];
}

/**
 * True when the student sits two or more fourth-type subjects and none is chosen on the
 * enrolment: the office must choose before results are processed (otherwise neither
 * would count).
 */
export function needsFourthChoice(
  papers: readonly ExamPaper[],
  student: { groupId: number | null; fourthSubjectId: number | null },
): boolean {
  if (student.fourthSubjectId !== null) return false;
  const fourth = new Set(
    papers
      .filter(
        (p) =>
          p.subjectType === "fourth" &&
          takesSubject(p.groupIds, student.groupId),
      )
      .map((p) => p.subjectId),
  );
  return fourth.size > 1;
}
