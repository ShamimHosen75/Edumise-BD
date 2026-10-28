import "server-only";

import type { Locale } from "@/i18n/config";
import {
  attendanceFrame,
  markableSections,
  sectionMarks,
  sectionRoster,
} from "@/lib/attendance-data";
import { buildSheet, monthDates } from "@/lib/attendance-sheet";
import type { CurrentUser } from "@/lib/auth/session";
import { isMonth } from "@/lib/routine";
import type { createClient } from "@/lib/supabase/server";

/** Everything the sheet page and the Excel export need, for sections the user may see. */
export async function loadSheet(
  db: Awaited<ReturnType<typeof createClient>>,
  me: CurrentUser,
  lang: Locale,
  q: { section?: string; month?: string },
) {
  const [frame, sections] = await Promise.all([
    attendanceFrame(db),
    markableSections(db, me, lang),
  ]);
  const section =
    sections.find((s) => String(s.id) === q.section) ?? sections[0];
  const month = isMonth(q.month) ? q.month : frame.today.slice(0, 7);
  if (!section || !frame.session)
    return { frame, sections, section, month, sheet: null };
  const dates = monthDates(month);
  const [roster, marks] = await Promise.all([
    sectionRoster(db, frame.session.id, section.id, lang),
    sectionMarks(db, section.id, dates[0]!, dates.at(-1)!),
  ]);
  const sheet = buildSheet(
    month,
    frame.today,
    roster,
    marks,
    frame.workingDays,
    frame.holidays,
  );
  return { frame, sections, section, month, sheet };
}

export const monthLabel = (month: string, lang: Locale) =>
  new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
