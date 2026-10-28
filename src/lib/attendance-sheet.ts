// The monthly attendance sheet as plain data (pure, unit tested): one row per student,
// one column per day of the month, with totals and the percentage.

import {
  STATUS_CODE,
  isSchoolDay,
  summarize,
  type AttendanceStatus,
  type Holiday,
  type Summary,
} from "@/lib/attendance";
import { datesBetween } from "@/lib/routine";

export type SheetRow = {
  studentId: number;
  roll: number;
  name: string;
  /** Status per date of the month (missing = not marked). */
  days: Record<string, AttendanceStatus>;
  summary: Summary;
};

export type Sheet = {
  dates: string[];
  /** Dates the school was open (up to today). */
  open: Set<string>;
  rows: SheetRow[];
};

export function monthDates(month: string): string[] {
  return datesBetween(`${month}-01`, `${month}-31`).filter((d) =>
    d.startsWith(month),
  );
}

export function buildSheet(
  month: string,
  today: string,
  roster: { studentId: number; roll: number; name: string }[],
  marks: { studentId: number; date: string; status: AttendanceStatus }[],
  workingDays: readonly number[],
  holidays: readonly Holiday[],
): Sheet {
  const dates = monthDates(month);
  const open = new Set(
    dates.filter((d) => d <= today && isSchoolDay(d, workingDays, holidays)),
  );
  const openDays = [...open];
  const rows = roster.map((r) => {
    const mine = marks.filter((m) => m.studentId === r.studentId);
    return {
      ...r,
      days: Object.fromEntries(mine.map((m) => [m.date, m.status])),
      summary: summarize(mine, openDays),
    };
  });
  return { dates, open, rows };
}

/** Header and rows for the Excel export (one-letter codes, numbers as numbers). */
export function sheetTable(
  sheet: Sheet,
  labels: {
    roll: string;
    name: string;
    codes: Record<AttendanceStatus, string>;
    percent: string;
  },
): (string | number | null)[][] {
  const head = [
    labels.roll,
    labels.name,
    ...sheet.dates.map((d) => Number(d.slice(8))),
    labels.codes.present,
    labels.codes.absent,
    labels.codes.late,
    labels.codes.leave,
    labels.percent,
  ];
  const body = sheet.rows.map((r) => [
    r.roll,
    r.name,
    ...sheet.dates.map((d) => (r.days[d] ? labels.codes[r.days[d]!] : null)),
    r.summary.present,
    r.summary.absent,
    r.summary.late,
    r.summary.leave,
    r.summary.percent,
  ]);
  return [head, ...body];
}

export { STATUS_CODE };
