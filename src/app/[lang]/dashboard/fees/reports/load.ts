import "server-only";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { duesReport, ledgerReport } from "@/lib/fee-dues";
import { periodNamer } from "@/lib/fee-periods";
import { monthBounds } from "@/lib/collection";
import { dailyReport, incomeReport } from "@/lib/fee-reports";
import { feeSessions, fineRule } from "@/lib/fees-data";
import { parsePeriod } from "@/lib/fees";
import { localizeDigits, toAsciiDigits } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import type { Report } from "@/lib/report-table";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const REPORTS = ["daily", "dues", "income", "ledger"] as const;
export type ReportKind = (typeof REPORTS)[number];

const isDay = (v: string | undefined): v is string =>
  !!v &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Reads the report filters from the address; unknown values fall back to defaults. */
export async function readFilters(
  db: Client,
  q: Record<string, string | undefined>,
) {
  const kind = REPORTS.find((k) => k === q.report) ?? "daily";
  const today = dhakaToday();
  const sessions = await feeSessions(db);
  const session =
    sessions.find((s) => String(s.id) === q.session) ??
    sessions.find((s) => s.current) ??
    sessions[0];
  const id = (v?: string) =>
    v && /^[1-9]\d{0,15}$/.test(v) ? Number(v) : undefined;
  const period = q.period?.trim();
  let student = id(q.student);
  const code = toAsciiDigits(q.code ?? "").trim();
  if (!student && /^\d{10}$/.test(code)) {
    const { data } = await db
      .from("students")
      .select("id")
      .eq("student_code", code)
      .maybeSingle();
    student = data?.id;
  }
  const from = isDay(q.from) ? q.from : monthBounds(today).from;
  return {
    kind,
    sessions,
    sessionId: session?.id,
    day: isDay(q.day) ? q.day : today,
    from,
    to: isDay(q.to) && q.to >= from ? q.to : today,
    classId: id(q.class),
    sectionId: id(q.section),
    period:
      period && parsePeriod(period)?.kind === "month" ? period : undefined,
    student,
    code,
  };
}
export type Filters = Awaited<ReturnType<typeof readFilters>>;

/** Builds the chosen report, or null when it needs more input (e.g. a student). */
export async function buildReport(
  db: Client,
  f: Filters,
  lang: Locale,
  dict: Dictionary,
): Promise<Report | null> {
  if (f.kind === "daily") return dailyReport(db, f.day, lang, dict);
  if (f.kind === "income") return incomeReport(db, f.from, f.to, lang, dict);
  if (f.kind === "ledger")
    return f.student ? ledgerReport(db, f.student, lang, dict) : null;
  if (!f.sessionId) return null;
  const [rule, periodName, { data: cls }, { data: sec }] = await Promise.all([
    fineRule(db),
    periodNamer(db, lang),
    f.classId
      ? db
          .from("classes")
          .select("name_en, name_bn")
          .eq("id", f.classId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    f.sectionId
      ? db
          .from("sections")
          .select("name_en, name_bn")
          .eq("id", f.sectionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const session = f.sessions.find((s) => s.id === f.sessionId)!;
  const pick = (x: { name_en: string; name_bn: string } | null) =>
    x ? (lang === "bn" && x.name_bn) || x.name_en : null;
  const subtitle = [
    localizeDigits(session.name, lang),
    pick(cls),
    pick(sec),
    f.period ? periodName(f.period) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return duesReport(
    db,
    {
      sessionId: f.sessionId,
      classId: f.classId,
      sectionId: f.sectionId,
      period: f.period,
    },
    rule,
    lang,
    dict,
    subtitle,
  );
}

/** The address of the report with the same filters (for export links). */
export function filterQuery(f: Filters): string {
  const p = new URLSearchParams({ report: f.kind });
  if (f.kind === "daily") p.set("day", f.day);
  if (f.kind === "income") {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  if (f.kind === "dues") {
    if (f.sessionId) p.set("session", String(f.sessionId));
    if (f.classId) p.set("class", String(f.classId));
    if (f.sectionId) p.set("section", String(f.sectionId));
    if (f.period) p.set("period", f.period);
  }
  if (f.kind === "ledger" && f.student) p.set("student", String(f.student));
  return p.toString();
}
