// Attendance arithmetic (pure, unit tested). Dates are "YYYY-MM-DD" in Dhaka time.

import { datesBetween } from "@/lib/routine";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "leave",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** One-letter codes for the monthly sheet. */
export const STATUS_CODE: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  late: "L",
  leave: "Lv",
};

/** Tap to cycle: Present -> Absent -> Late -> Leave -> Present. */
export function nextStatus(s: AttendanceStatus): AttendanceStatus {
  const i = ATTENDANCE_STATUSES.indexOf(s);
  return ATTENDANCE_STATUSES[(i + 1) % ATTENDANCE_STATUSES.length]!;
}

export type Holiday = { start: string; end: string };

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** True when the school is open: a working weekday and not a holiday. */
export function isSchoolDay(
  date: string,
  workingDays: readonly number[],
  holidays: readonly Holiday[],
): boolean {
  return (
    workingDays.includes(weekday(date)) &&
    !holidays.some((h) => h.start <= date && date <= h.end)
  );
}

/** School days from start to end (inclusive). */
export function schoolDays(
  start: string,
  end: string,
  workingDays: readonly number[],
  holidays: readonly Holiday[],
): string[] {
  return datesBetween(start, end).filter((d) =>
    isSchoolDay(d, workingDays, holidays),
  );
}

export type DayMark = { date: string; status: AttendanceStatus };

export type Summary = {
  present: number;
  absent: number;
  late: number;
  leave: number;
  /** School days with no mark yet. */
  unmarked: number;
  schoolDays: number;
  /** (Present + Late) / (school days marked − Leave), 0–100 with one decimal; null if none. */
  percent: number | null;
};

/**
 * Counts for one student. Marks on days the school was closed are ignored. Leave is not
 * absence: it is taken out of the days counted. Late counts as attended. Days not marked
 * yet are not counted either way (open question 24).
 */
export function summarize(
  marks: readonly DayMark[],
  days: readonly string[],
): Summary {
  const open = new Set(days);
  const byDate = new Map(
    marks.filter((m) => open.has(m.date)).map((m) => [m.date, m.status]),
  );
  const count = (s: AttendanceStatus) =>
    [...byDate.values()].filter((v) => v === s).length;
  const present = count("present");
  const absent = count("absent");
  const late = count("late");
  const leave = count("leave");
  return {
    present,
    absent,
    late,
    leave,
    unmarked: days.length - byDate.size,
    schoolDays: days.length,
    percent: attendancePercent({ present, absent, late }),
  };
}

/** (Present + Late) / (Present + Absent + Late), one decimal; null when nothing counted. */
export function attendancePercent(c: {
  present: number;
  absent: number;
  late: number;
}): number | null {
  const counted = c.present + c.absent + c.late;
  return counted
    ? Math.round(((c.present + c.late) / counted) * 1000) / 10
    : null;
}

/**
 * Absences in a row up to the last marked school day (a streak to follow up). Leave and
 * unmarked days do not break or extend the streak.
 */
export function absenceStreak(
  marks: readonly DayMark[],
  days: readonly string[],
): number {
  const byDate = new Map(marks.map((m) => [m.date, m.status]));
  let streak = 0;
  for (const d of [...days].sort().reverse()) {
    const s = byDate.get(d);
    if (s === undefined || s === "leave") continue;
    if (s !== "absent") break;
    streak++;
  }
  return streak;
}

/** Teachers may mark today and the 3 days before; admins any day up to today. */
export function canMark(
  date: string,
  today: string,
  role: "teacher" | "admin",
): boolean {
  if (date > today) return false;
  if (role === "admin") return true;
  return datesBetween(date, today).length <= 4;
}
