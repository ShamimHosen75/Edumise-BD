import { toAsciiDigits } from "@/lib/format";

// Pure helpers for admissions (unit tested).

/** A Bangladesh birth registration number: exactly 17 digits (Bangla digits allowed). */
export function normalizeBirthRegNo(value: string): string {
  return toAsciiDigits(value).replace(/[\s-]/g, "");
}

export function isBirthRegNo(value: string): boolean {
  return /^[0-9]{17}$/.test(normalizeBirthRegNo(value));
}

/** ADM-2026-00001: year and a running number, at least 5 digits. */
export function formatTrackingNo(year: number, n: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(n) || n < 1)
    throw new RangeError("Invalid tracking number parts");
  return `ADM-${year}-${String(n).padStart(5, "0")}`;
}

/** Cleans what a visitor typed ("adm 2026 1" -> "ADM-2026-00001"), or null. */
export function normalizeTrackingNo(value: string): string | null {
  const m = /^ADM[\s-]*(\d{4})[\s-]*(\d{1,9})$/i.exec(
    toAsciiDigits(value).trim(),
  );
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 ? formatTrackingNo(Number(m[1]), n) : null;
}

/** Student ID: year + 2-digit class + 4-digit serial, e.g. 2026060012. */
export function studentCode(
  year: number,
  level: number,
  serial: number,
): string {
  return `${year}${String(level).padStart(2, "0")}${String(serial).padStart(4, "0")}`;
}

/** The next roll in a section: one after the highest (rolls are never reused mid-year). */
export function nextRoll(rolls: number[]): number {
  return rolls.length ? Math.max(...rolls) + 1 : 1;
}

/** Age in whole years on a date (birthday counted), for the application check. */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * Merit list: applicants with test marks, highest first; equal marks share a rank
 * (1, 2, 2, 4) and are listed by who applied first. Rejected applicants are left out.
 */
export function meritList<
  T extends { test_marks: number | null; submitted_at: string; status: string },
>(rows: T[]): (T & { rank: number; test_marks: number })[] {
  const scored = rows
    .filter(
      (r): r is T & { test_marks: number } =>
        r.test_marks !== null && r.status !== "rejected",
    )
    .sort(
      (a, b) =>
        b.test_marks - a.test_marks ||
        a.submitted_at.localeCompare(b.submitted_at),
    );
  return scored.map((r, i) => ({
    ...r,
    rank:
      i > 0 && scored[i - 1]!.test_marks === r.test_marks
        ? scored.findIndex((x) => x.test_marks === r.test_marks) + 1
        : i + 1,
  }));
}
