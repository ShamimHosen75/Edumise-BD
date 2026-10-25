import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import type { Booking } from "@/lib/routine";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;
type Named = { name_en: string; name_bn: string };
type Person = { full_name_en: string; full_name_bn: string } | null;
const one = <T>(v: unknown) => v as T;

export type Period = {
  id: number;
  number: number;
  starts_at: string;
  ends_at: string;
  is_break: boolean;
};

/** A class in the routine, with names ready to show. */
export type RoutineEntry = Booking & {
  subject: string;
  teacher: string;
  room: string;
  level: number;
};

const SELECT =
  "section_id, day_of_week, period_id, subject_id, staff_id, room_id, subject:subjects(name_en, name_bn), staff:staff(full_name_en, full_name_bn), room:rooms(name), section:sections(name_en, name_bn, class:classes(level, name_en, name_bn))";

function entry(r: Record<string, unknown>, lang: Locale): RoutineEntry {
  const section = one<Named & { class: Named & { level: number } }>(r.section);
  const staff = one<Person>(r.staff);
  return {
    sectionId: r.section_id as number,
    section: `${pickLocalized(section.class, "name", lang)} ${pickLocalized(section, "name", lang)}`,
    level: section.class.level,
    day: r.day_of_week as number,
    periodId: r.period_id as number,
    subjectId: r.subject_id as number,
    staffId: (r.staff_id as number | null) ?? null,
    roomId: (r.room_id as number | null) ?? null,
    subject: pickLocalized(one<Named>(r.subject), "name", lang),
    // Visitors only see teachers listed on the public staff directory.
    teacher: staff ? pickLocalized(staff, "full_name", lang) : "",
    room: one<{ name: string } | null>(r.room)?.name ?? "",
  };
}

export async function currentSession(db: Db) {
  const { data } = await db
    .from("academic_sessions")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();
  return data;
}

/** Periods, working days and the session: the frame of every routine grid. */
export async function routineFrame(db: Db) {
  const [{ data: periods }, { data: settings }, session] = await Promise.all([
    db
      .from("periods")
      .select("id, number, starts_at, ends_at, is_break")
      .order("number"),
    db.from("school_settings").select("working_days").maybeSingle(),
    currentSession(db),
  ]);
  return {
    periods: (periods ?? []) as Period[],
    workingDays: settings?.working_days ?? [6, 0, 1, 2, 3, 4],
    session,
  };
}

/** Routine rows of a session, for one section, one teacher or everyone. */
export async function routineEntries(
  db: Db,
  sessionId: number,
  lang: Locale,
  filter: { sectionId?: number; staffId?: number } = {},
): Promise<RoutineEntry[]> {
  let q = db.from("routine").select(SELECT).eq("session_id", sessionId);
  if (filter.sectionId) q = q.eq("section_id", filter.sectionId);
  if (filter.staffId) q = q.eq("staff_id", filter.staffId);
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => entry(r, lang));
}

/** Subjects of a class (all groups, for Classes 9 and 10), in subject order. */
export async function classSubjectOptions(
  db: Db,
  classId: number,
  lang: Locale,
) {
  const { data } = await db
    .from("class_subjects")
    .select("subject:subjects(id, name_en, name_bn, sort_order)")
    .eq("class_id", classId);
  const subjects = new Map<
    number,
    Named & { id: number; sort_order: number }
  >();
  for (const r of data ?? []) {
    const s = one<Named & { id: number; sort_order: number }>(r.subject);
    subjects.set(s.id, s);
  }
  return [...subjects.values()]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, name: pickLocalized(s, "name", lang) }));
}
