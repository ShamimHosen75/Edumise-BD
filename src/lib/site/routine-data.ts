import "server-only";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { datesBetween } from "@/lib/routine";
import {
  routineEntries,
  routineFrame,
  type Period,
  type RoutineEntry,
} from "@/lib/routine-data";
import { createPublicClient } from "@/lib/supabase/public";

import { cachedPublicQuery, TAGS } from "./cache";

type Named = { name_en: string; name_bn: string };
const one = <T>(v: unknown) => v as T;

export type PublicFrame = {
  periods: Period[];
  workingDays: number[];
  session: { id: number; name: string } | null;
  sections: { id: number; level: number; name: string }[];
};

/** Periods, working days, current session and sections (as "Class 6 A"). */
export const getRoutineFrame = cachedPublicQuery(
  "routine-frame",
  [TAGS.routine, TAGS.settings, TAGS.stats],
  async (lang: Locale): Promise<PublicFrame> => {
    const db = createPublicClient();
    const [frame, { data, error }] = await Promise.all([
      routineFrame(db),
      db
        .from("sections")
        .select("id, name_en, name_bn, class:classes(level, name_en, name_bn)"),
    ]);
    if (error) throw new Error(error.message);
    const sections = (data ?? [])
      .map((s) => {
        const c = one<Named & { level: number }>(s.class);
        return {
          id: s.id,
          level: c.level,
          name: `${pickLocalized(c, "name", lang)} ${pickLocalized(s, "name", lang)}`,
        };
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    return { ...frame, sections };
  },
  { periods: [], workingDays: [6, 0, 1, 2, 3, 4], session: null, sections: [] },
);

export const getSectionRoutine = cachedPublicQuery(
  "section-routine",
  [TAGS.routine, TAGS.staff],
  (
    sessionId: number,
    sectionId: number,
    lang: Locale,
  ): Promise<RoutineEntry[]> =>
    routineEntries(createPublicClient(), sessionId, lang, { sectionId }),
  [],
);

export type ExamPaper = {
  date: string;
  startsAt: string;
  endsAt: string;
  subject: string;
};
export type PublicExam = {
  id: number;
  name: string;
  classes: { id: number; level: number; name: string; papers: ExamPaper[] }[];
};

/** Exams of the current session whose schedule is published, papers by class and date. */
export const getExamRoutines = cachedPublicQuery(
  "exam-routines",
  [TAGS.routine],
  async (lang: Locale): Promise<PublicExam[]> => {
    const db = createPublicClient();
    const { data, error } = await db
      .from("exams")
      .select(
        "id, name_en, name_bn, starts_on, session:academic_sessions!inner(is_current), exam_schedule(exam_date, starts_at, ends_at, class:classes(id, level, name_en, name_bn), subject:subjects(name_en, name_bn))",
      )
      .eq("schedule_published", true)
      .eq("session.is_current", true)
      .order("starts_on", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((e) => {
      const byClass = new Map<number, PublicExam["classes"][number]>();
      for (const p of e.exam_schedule) {
        const c = one<Named & { id: number; level: number }>(p.class);
        const entry = byClass.get(c.id) ?? {
          id: c.id,
          level: c.level,
          name: pickLocalized(c, "name", lang),
          papers: [],
        };
        entry.papers.push({
          date: p.exam_date,
          startsAt: p.starts_at,
          endsAt: p.ends_at,
          subject: pickLocalized(one<Named>(p.subject), "name", lang),
        });
        byClass.set(c.id, entry);
      }
      return {
        id: e.id,
        name: pickLocalized(e, "name", lang),
        classes: [...byClass.values()]
          .sort((a, b) => a.level - b.level)
          .map((c) => ({
            ...c,
            papers: c.papers.sort((a, b) =>
              `${a.date}${a.startsAt}`.localeCompare(`${b.date}${b.startsAt}`),
            ),
          })),
      };
    });
  },
  [],
);

export type CalendarItem = {
  kind: "holiday" | "event";
  title: string;
  start: string;
  end: string;
  href?: string;
};

/** Dhaka calendar date of a timestamp. */
const dhakaDate = (ts: string) => dhakaToday(new Date(ts));

/** Holidays and published events that touch a month ("YYYY-MM"). */
export const getCalendarMonth = cachedPublicQuery(
  "calendar-month",
  [TAGS.calendar, TAGS.events],
  async (month: string, lang: Locale): Promise<CalendarItem[]> => {
    const db = createPublicClient();
    const first = `${month}-01`;
    const last = datesBetween(first, `${month}-31`)
      .filter((d) => d.startsWith(month))
      .at(-1)!;
    const [holidays, events] = await Promise.all([
      db
        .from("holidays")
        .select("title_en, title_bn, starts_on, ends_on")
        .lte("starts_on", last)
        .gte("ends_on", first)
        .order("starts_on"),
      // Events are stored with times; a day either side covers the time zone.
      db
        .from("events")
        .select("slug, title_en, title_bn, starts_at, ends_at")
        .gte("starts_at", `${first}T00:00:00+06:00`)
        .lte("starts_at", `${last}T23:59:59+06:00`)
        .order("starts_at"),
    ]);
    if (holidays.error) throw new Error(holidays.error.message);
    if (events.error) throw new Error(events.error.message);
    return [
      ...(holidays.data ?? []).map((h) => ({
        kind: "holiday" as const,
        title: pickLocalized(h, "title", lang),
        start: h.starts_on,
        end: h.ends_on,
      })),
      ...(events.data ?? []).map((e) => ({
        kind: "event" as const,
        title: pickLocalized(e, "title", lang),
        start: dhakaDate(e.starts_at),
        end: dhakaDate(e.ends_at ?? e.starts_at),
        href: `/${lang}/events/${e.slug}`,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));
  },
  [],
);
