// Grading and results (pure, unit tested). Bangladesh SSC rules, scale from settings.
//
// - Percent per subject = obtained / full * 100, compared exactly (79.5 is an A, Q30).
// - A part (CQ, MCQ, practical) with pass marks must be passed on its own; failing a part
//   or being absent is F.
// - Two papers of one subject (same paper group, Q32) are added up before grading; part
//   pass marks are added up too.
// - F in any compulsory subject: overall Fail, GPA 0.00.
// - Fourth subject: only the grade point above 2.00 is added; it never fails a student.
// - GPA = (compulsory points + fourth bonus) / number of compulsory subjects, at most the
//   top point of the scale, rounded to 2 decimals.

import { z } from "zod";

import { PARTS, type Part } from "@/lib/marks";

export type Band = { min: number; grade: string; point: number };

export const DEFAULT_SCALE: readonly Band[] = [
  { min: 80, grade: "A+", point: 5 },
  { min: 70, grade: "A", point: 4 },
  { min: 60, grade: "A-", point: 3.5 },
  { min: 50, grade: "B", point: 3 },
  { min: 40, grade: "C", point: 2 },
  { min: 33, grade: "D", point: 1 },
  { min: 0, grade: "F", point: 0 },
];

/** Fourth-subject points up to this value add nothing. */
export const FOURTH_BASE = 2;

const scaleSchema = z
  .array(
    z.object({
      min: z.number().min(0).max(100),
      grade: z.string().trim().min(1).max(3),
      point: z.number().min(0).max(5),
    }),
  )
  .min(2)
  .refine((s) => s.some((b) => b.min === 0), "a band must start at 0")
  .refine((s) => new Set(s.map((b) => b.min)).size === s.length, "same min")
  .transform((s) => [...s].sort((a, b) => b.min - a.min))
  .refine(
    (s) => s.every((b, i) => i === 0 || b.point < s[i - 1]!.point),
    "points must go down with the marks",
  );

/** The school's scale (school_settings.grading), highest band first. Throws if invalid. */
export function parseScale(json: unknown): Band[] {
  const parsed = scaleSchema.safeParse(json);
  if (!parsed.success) throw new Error("Invalid grading scale");
  return parsed.data;
}

const failBand = (scale: readonly Band[]) => scale[scale.length - 1]!;

/** Grade and point for a percentage (exact comparison, no rounding). */
export function gradeFor(percent: number, scale: readonly Band[]): Band {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    throw new Error("Percent out of range");
  return scale.find((b) => percent >= b.min) ?? failBand(scale);
}

/** Overall letter grade for a GPA: the best band whose point the GPA reaches. */
export function gradeForGpa(gpa: number, scale: readonly Band[]): Band {
  return scale.find((b) => gpa >= b.point) ?? failBand(scale);
}

/** Rounds to 2 decimals (4.125 -> 4.13), avoiding binary float surprises. */
export const round2 = (x: number) => Math.round((x + 1e-9) * 100) / 100;

type Marks = {
  cq: number | null;
  mcq: number | null;
  practical: number | null;
  is_absent: boolean;
};

/** One exam paper (exam subject) and one student's marks in it (null: not entered). */
export type PaperInput = {
  examSubjectId: number;
  cq_full: number;
  mcq_full: number;
  practical_full: number;
  cq_pass: number | null;
  mcq_pass: number | null;
  practical_pass: number | null;
  mark: Marks | null;
};

export type SubjectRole = "compulsory" | "fourth" | "extra";

/** A graded subject: one paper, or the papers of one paper group. */
export type SubjectInput = {
  key: string;
  role: SubjectRole;
  papers: PaperInput[];
};

export type SubjectGrade = {
  key: string;
  role: SubjectRole;
  obtained: number;
  full: number;
  percent: number;
  grade: string;
  point: number;
  absent: boolean;
  /** Parts below their pass marks. */
  failedParts: Part[];
  failed: boolean;
  /** Some paper has no marks entered (processing refuses this). */
  missing: boolean;
};

/** Absent, or every part in use has a mark (a part left empty is "missing", not 0). */
const complete = (p: PaperInput) =>
  p.mark !== null &&
  (p.mark.is_absent ||
    PARTS.every((part) => p[`${part}_full`] === 0 || p.mark![part] !== null));

export function gradeSubject(
  subject: SubjectInput,
  scale: readonly Band[],
): SubjectGrade {
  const { papers } = subject;
  if (!papers.length) throw new Error("A subject needs at least one paper");
  const missing = papers.some((p) => !complete(p));
  const absent = missing || papers.some((p) => p.mark!.is_absent);
  const sum = (f: (p: PaperInput) => number) =>
    papers.reduce((s, p) => s + f(p), 0);
  const full = sum((p) => p.cq_full + p.mcq_full + p.practical_full);
  const got = (part: Part) => sum((p) => (absent ? 0 : (p.mark![part] ?? 0)));
  const obtained = round2(PARTS.reduce((s, part) => s + got(part), 0));
  const failedParts = absent
    ? []
    : PARTS.filter((part) => {
        // Only papers with pass marks for this part count towards that pass mark, so
        // one paper's high marks cannot hide another paper's fail.
        const pass = papers.filter((p) => p[`${part}_pass`] !== null);
        return (
          pass.length > 0 &&
          pass.reduce((t, p) => t + (p.mark![part] ?? 0), 0) <
            pass.reduce((t, p) => t + p[`${part}_pass`]!, 0)
        );
      });
  const percent = full > 0 ? (obtained / full) * 100 : 0;
  const band =
    absent || failedParts.length
      ? failBand(scale)
      : gradeFor(Math.min(100, percent), scale);
  return {
    key: subject.key,
    role: subject.role,
    obtained,
    full,
    percent: round2(percent),
    grade: band.grade,
    point: band.point,
    absent,
    failedParts,
    failed: band === failBand(scale),
    missing,
  };
}

export type StudentResult = {
  passed: boolean;
  gpa: number;
  gpaWithoutFourth: number;
  grade: string;
  /** Marks of the compulsory and fourth subjects. */
  total: number;
  fullTotal: number;
  /** Compulsory subjects failed. */
  failedCount: number;
};

export function studentResult(
  subjects: readonly SubjectGrade[],
  scale: readonly Band[],
): StudentResult {
  const compulsory = subjects.filter((s) => s.role === "compulsory");
  const fourth = subjects.filter((s) => s.role === "fourth");
  if (fourth.length > 1) throw new Error("Only one fourth subject is allowed");
  const counted = [...compulsory, ...fourth];
  const failedCount = compulsory.filter((s) => s.failed).length;
  const passed = compulsory.length > 0 && failedCount === 0;
  const points = compulsory.reduce((s, x) => s + x.point, 0);
  const bonus = Math.max(0, (fourth[0]?.point ?? 0) - FOURTH_BASE);
  const top = scale[0]!.point;
  const gpa = passed
    ? round2(Math.min(top, (points + bonus) / compulsory.length))
    : 0;
  return {
    passed,
    gpa,
    gpaWithoutFourth: passed ? round2(points / compulsory.length) : 0,
    grade: passed ? gradeForGpa(gpa, scale).grade : failBand(scale).grade,
    total: round2(counted.reduce((s, x) => s + x.obtained, 0)),
    fullTotal: counted.reduce((s, x) => s + x.full, 0),
    failedCount,
  };
}

export type RankRow = {
  id: number;
  passed: boolean;
  gpa: number;
  total: number;
  roll: number;
  /** Breaks equal rolls across sections (the section's order in the class). */
  sectionOrder?: number;
};

/**
 * Merit positions 1..n (Q33). Passed students first, then by GPA (with the fourth
 * subject), total marks, roll, section order; every position is unique.
 */
export function rankResults(rows: readonly RankRow[]): Map<number, number> {
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.passed) - Number(a.passed) ||
      b.gpa - a.gpa ||
      b.total - a.total ||
      a.roll - b.roll ||
      (a.sectionOrder ?? 0) - (b.sectionOrder ?? 0) ||
      a.id - b.id,
  );
  return new Map(sorted.map((r, i) => [r.id, i + 1]));
}
