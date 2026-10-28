// Marks entry rules (pure, unit tested): parts in use, limits, totals and import rows.

import { toAsciiDigits } from "@/lib/format";

export const PARTS = ["cq", "mcq", "practical"] as const;
export type Part = (typeof PARTS)[number];

export type FullMarks = {
  cq_full: number;
  mcq_full: number;
  practical_full: number;
};

/** One student's marks as entered: a number per part, or empty (null). */
export type MarkRow = {
  student_id: number;
  cq: number | null;
  mcq: number | null;
  practical: number | null;
  is_absent: boolean;
};

/** Parts used by this exam subject (full marks above 0). */
export function partsInUse(es: FullMarks): Part[] {
  return PARTS.filter((p) => es[`${p}_full`] > 0);
}

/** Text from an input ("৬৫.৫", " 70 ", "") -> number, null for empty, NaN for bad text. */
export function readMark(text: string): number | null {
  const v = toAsciiDigits(text).trim();
  if (v === "") return null;
  return /^\d{1,3}(\.\d{1,2})?$/.test(v) ? Number(v) : Number.NaN;
}

export type MarkProblem = "range" | "unused" | "absentWithMarks";

/** Problems in one row, by part ("row" for the absent rule). */
export function checkMarkRow(
  row: MarkRow,
  es: FullMarks,
): Partial<Record<Part | "row", MarkProblem>> {
  const problems: Partial<Record<Part | "row", MarkProblem>> = {};
  for (const p of PARTS) {
    const v = row[p];
    if (v === null) continue;
    const full = es[`${p}_full`];
    if (full === 0) problems[p] = "unused";
    else if (!Number.isFinite(v) || v < 0 || v > full) problems[p] = "range";
  }
  if (row.is_absent && PARTS.some((p) => row[p] !== null))
    problems.row = "absentWithMarks";
  return problems;
}

/** Entered: absent, or at least one part filled in. */
export const isEntered = (row: MarkRow) =>
  row.is_absent || PARTS.some((p) => row[p] !== null);

/** Total of the parts (absent or nothing entered: null). */
export function markTotal(row: MarkRow): number | null {
  if (!isEntered(row) || row.is_absent) return null;
  return PARTS.reduce((sum, p) => sum + (row[p] ?? 0), 0);
}

const truthy = (v: string) =>
  ["1", "yes", "y", "true", "absent", "a", "হ্যাঁ", "অনুপস্থিত"].includes(
    v.trim().toLowerCase(),
  );

export type ImportedMark = {
  line: number;
  roll: number | null;
  row: MarkRow | null;
  problems: string[];
};

/**
 * Rows of a marks file (columns roll, name, cq, mcq, practical, absent) matched to the
 * section's students by roll. Problems are dictionary keys.
 */
export function readMarkRows(
  records: Record<string, unknown>[],
  roster: { studentId: number; roll: number }[],
  es: FullMarks,
): ImportedMark[] {
  const seen = new Set<number>();
  return records.map((rec, i) => {
    const get = (key: string) => {
      const found = Object.entries(rec).find(
        ([k]) => k.trim().toLowerCase().replace(/\s+/g, "_") === key,
      );
      return found?.[1] === undefined || found[1] === null
        ? ""
        : String(found[1]);
    };
    const problems: string[] = [];
    const rollText = toAsciiDigits(get("roll")).trim();
    const roll = /^\d{1,3}$/.test(rollText) ? Number(rollText) : null;
    const student = roster.find((r) => r.roll === roll);
    if (!student) problems.push("marks.import.unknownRoll");
    else if (seen.has(student.studentId)) problems.push("marks.import.twice");
    if (student) seen.add(student.studentId);
    const row: MarkRow = {
      student_id: student?.studentId ?? 0,
      cq: readMark(get("cq")),
      mcq: readMark(get("mcq")),
      practical: readMark(get("practical")),
      is_absent: truthy(get("absent")),
    };
    const checked = checkMarkRow(row, es);
    if (Object.values(checked).includes("range"))
      problems.push("marks.import.range");
    if (Object.values(checked).includes("unused"))
      problems.push("marks.import.unused");
    if (checked.row) problems.push("marks.import.absentWithMarks");
    return {
      line: i + 2,
      roll,
      row: problems.length ? null : row,
      problems,
    };
  });
}
