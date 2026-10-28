"use server";

import { z } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { invalid } from "@/lib/actions";
import { ATTENDANCE_STATUSES, canMark, isSchoolDay } from "@/lib/attendance";
import {
  attendanceFrame,
  isAdmin,
  markableSections,
} from "@/lib/attendance-data";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const id = z.number().int().positive();
const saveSchema = z.object({
  section_id: id,
  date: z.iso.date("errors.date"),
  marks: z
    .array(z.object({ student_id: id, status: z.enum(ATTENDANCE_STATUSES) }))
    .min(1)
    .max(300),
});

export type SaveAttendanceResult =
  { ok: true } | { ok: false; error: TranslationKey };

/**
 * Saves a section's attendance for one day in one statement (insert or update each
 * student). Checked here for a clear message, and again by the database policies.
 */
export async function saveAttendance(
  lang: string,
  input: unknown,
): Promise<SaveAttendanceResult> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const me = await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as SaveAttendanceResult;
  const { section_id, date, marks } = parsed.data;
  const db = await createClient();
  const frame = await attendanceFrame(db);
  const role = isAdmin(me) ? "admin" : "teacher";
  if (date > frame.today)
    return { ok: false, error: "errors.attendanceFuture" };
  if (!canMark(date, frame.today, role))
    return { ok: false, error: "errors.attendanceWindow" };
  if (!isSchoolDay(date, frame.workingDays, frame.holidays))
    return { ok: false, error: "errors.schoolClosed" };
  const sections = await markableSections(db, me, lang);
  if (!frame.session || !sections.some((s) => s.id === section_id))
    return { ok: false, error: "errors.notAllowed" };

  const { data: enrolled } = await db
    .from("enrollments")
    .select("student_id")
    .eq("session_id", frame.session.id)
    .eq("section_id", section_id)
    .in(
      "student_id",
      marks.map((m) => m.student_id),
    );
  if ((enrolled ?? []).length !== new Set(marks.map((m) => m.student_id)).size)
    return { ok: false, error: "errors.notInSection" };

  const { error } = await db.from("attendance").upsert(
    marks.map((m) => ({
      student_id: m.student_id,
      section_id,
      date,
      status: m.status,
      marked_by: me.id,
    })),
    { onConflict: "student_id,date" },
  );
  if (error?.code === "42501")
    return { ok: false, error: "errors.attendanceWindow" };
  if (error) return { ok: false, error: "auth.unexpected" };
  return { ok: true };
}
