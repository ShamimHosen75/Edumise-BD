import "server-only";

import type { Locale } from "@/i18n/config";
import {
  isSchoolDay,
  type AttendanceStatus,
  type Holiday,
} from "@/lib/attendance";
import type { CurrentUser } from "@/lib/auth/session";
import { pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import {
  classChoices,
  sectionOptions,
  type SectionOption,
} from "@/lib/students-data";

type Client = Awaited<ReturnType<typeof createClient>>;

export const isAdmin = (u: CurrentUser) =>
  u.role === "admin" || u.role === "super_admin";

/** Sections the user may take attendance for: all (admins), or their own (teachers). */
export async function markableSections(
  db: Client,
  user: CurrentUser,
  lang: Locale,
): Promise<SectionOption[]> {
  const all = await sectionOptions(db, lang);
  if (isAdmin(user)) return all;
  const { data: staff } = await db
    .from("staff")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!staff) return [];
  const [{ data: assigned }, { data: classTeacher }] = await Promise.all([
    db
      .from("teacher_assignments")
      .select("section_id, session:academic_sessions!inner(is_current)")
      .eq("staff_id", staff.id)
      .eq("session.is_current", true),
    db.from("sections").select("id").eq("class_teacher_id", staff.id),
  ]);
  const mine = new Set([
    ...(assigned ?? []).map((a) => a.section_id),
    ...(classTeacher ?? []).map((s) => s.id),
  ]);
  return all.filter((s) => mine.has(s.id));
}

/** Working weekdays, holidays and the current session. */
export async function attendanceFrame(db: Client) {
  const [{ data: settings }, { data: holidays }, { data: session }] =
    await Promise.all([
      db.from("school_settings").select("working_days").maybeSingle(),
      db.from("holidays").select("starts_on, ends_on"),
      db
        .from("academic_sessions")
        .select("id, name, starts_on, ends_on")
        .eq("is_current", true)
        .maybeSingle(),
    ]);
  return {
    today: dhakaToday(),
    workingDays: settings?.working_days ?? [6, 0, 1, 2, 3, 4],
    holidays: (holidays ?? []).map((h): Holiday => ({
      start: h.starts_on,
      end: h.ends_on,
    })),
    session,
  };
}

export type RosterRow = { studentId: number; roll: number; name: string };

/** Students of a section in a session, by roll. */
export async function sectionRoster(
  db: Client,
  sessionId: number,
  sectionId: number,
  lang: Locale,
): Promise<RosterRow[]> {
  const rows = await fetchAll((from, to) =>
    db
      .from("enrollments")
      .select("roll, student:students(id, full_name_en, full_name_bn)")
      .eq("session_id", sessionId)
      .eq("section_id", sectionId)
      .order("roll")
      .range(from, to),
  );
  return rows.map((r) => {
    const s = r.student as unknown as {
      id: number;
      full_name_en: string;
      full_name_bn: string;
    };
    return {
      studentId: s.id,
      roll: r.roll,
      name: pickLocalized(s, "full_name", lang),
    };
  });
}

export type MarkRow = {
  studentId: number;
  date: string;
  status: AttendanceStatus;
};

/** Marks of a section between two dates (inclusive). */
export async function sectionMarks(
  db: Client,
  sectionId: number,
  from: string,
  to: string,
): Promise<MarkRow[]> {
  const rows = await fetchAll((a, b) =>
    db
      .from("attendance")
      .select("student_id, date, status")
      .eq("section_id", sectionId)
      .gte("date", from)
      .lte("date", to)
      .order("id")
      .range(a, b),
  );
  return rows.map((r) => ({
    studentId: r.student_id,
    date: r.date,
    status: r.status,
  }));
}

/** One student's marks between two dates (RLS: the student, their guardians, staff). */
export async function studentMarks(
  db: Client,
  studentId: number,
  from: string,
  to: string,
) {
  const { data, error } = await db
    .from("attendance")
    .select("date, status")
    .eq("student_id", studentId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ date: r.date, status: r.status }));
}

export type ClassToday = {
  classId: number;
  level: number;
  name: string;
  enrolled: number;
  marked: number;
  attended: number;
};

/** Today's attendance by class, and the sections with no marks yet (admin home). */
export async function attendanceToday(db: Client, lang: Locale) {
  const frame = await attendanceFrame(db);
  if (!frame.session) return null;
  const sessionId = frame.session.id;
  const [sections, classes, enrolled, marks] = await Promise.all([
    sectionOptions(db, lang),
    classChoices(db, lang),
    fetchAll((a, b) =>
      db
        .from("enrollments")
        .select("section_id")
        .eq("session_id", sessionId)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("attendance")
        .select("section_id, status")
        .eq("date", frame.today)
        .order("id")
        .range(a, b),
    ),
  ]);
  const byClass = new Map<number, ClassToday>();
  const sectionClass = new Map(sections.map((s) => [s.id, s]));
  const markedSections = new Set(marks.map((m) => m.section_id));
  const classOf = (sectionId: number) => {
    const s = sectionClass.get(sectionId);
    if (!s) return null;
    const row = byClass.get(s.classId) ?? {
      classId: s.classId,
      level: s.level,
      name: classes.find((c) => c.id === s.classId)?.name ?? s.name,
      enrolled: 0,
      marked: 0,
      attended: 0,
    };
    byClass.set(s.classId, row);
    return row;
  };
  for (const e of enrolled) {
    const row = classOf(e.section_id);
    if (row) row.enrolled++;
  }
  for (const m of marks) {
    const row = classOf(m.section_id);
    if (!row) continue;
    if (m.status !== "leave") row.marked++;
    if (m.status === "present" || m.status === "late") row.attended++;
  }
  const withStudents = new Set(enrolled.map((e) => e.section_id));
  return {
    today: frame.today,
    open: isSchoolDay(frame.today, frame.workingDays, frame.holidays),
    classes: [...byClass.values()].sort((a, b) => a.level - b.level),
    unmarked: sections.filter(
      (s) => withStudents.has(s.id) && !markedSections.has(s.id),
    ),
  };
}
