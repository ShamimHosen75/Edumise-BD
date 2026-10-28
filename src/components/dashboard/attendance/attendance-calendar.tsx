import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import {
  isSchoolDay,
  schoolDays,
  summarize,
  type AttendanceStatus,
  type Holiday,
} from "@/lib/attendance";
import { monthDates } from "@/lib/attendance-sheet";
import { localizeDigits } from "@/lib/format";
import { monthGrid, shiftMonth, weekDays } from "@/lib/routine";
import { cn } from "@/lib/utils";

const TONE: Record<AttendanceStatus, string> = {
  present: "bg-primary/15 text-primary",
  absent: "bg-destructive/15 text-destructive",
  late: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  leave: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
};
const ALL_DAYS = weekDays([0, 1, 2, 3, 4, 5, 6]);

/** One child's month: a calendar coloured by status, and the month's percentage. */
export function AttendanceCalendar({
  lang,
  dict,
  month,
  today,
  marks,
  workingDays,
  holidays,
  base,
  title,
}: {
  lang: Locale;
  dict: Dictionary;
  month: string;
  today: string;
  marks: { date: string; status: AttendanceStatus }[];
  workingDays: number[];
  holidays: Holiday[];
  /** Page address; ?month= is added for the previous/next links. */
  base: string;
  title: string;
}) {
  const a = dict.attendance;
  const n = (v: number) => localizeDigits(v, lang);
  const byDate = new Map(marks.map((m) => [m.date, m.status]));
  const dates = monthDates(month);
  const last = dates.at(-1)! < today ? dates.at(-1)! : today;
  const days =
    last >= dates[0]! ? schoolDays(dates[0]!, last, workingDays, holidays) : [];
  const s = summarize(marks, days);
  const monthName = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const nav = "hover:bg-accent rounded-md border px-3 py-2 text-sm";

  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <nav
        aria-label={a.month}
        className="flex items-center justify-between gap-2"
      >
        <Link href={`${base}?month=${shiftMonth(month, -1)}`} className={nav}>
          <span aria-hidden="true">←</span> {a.prev}
        </Link>
        <h2 className="font-semibold" data-testid="attendance-month">
          {monthName}
        </h2>
        <Link href={`${base}?month=${shiftMonth(month, 1)}`} className={nav}>
          {a.next} <span aria-hidden="true">→</span>
        </Link>
      </nav>
      <div className="rounded-xl border p-4" data-testid="attendance-summary">
        <p className="text-2xl font-semibold">
          {t(dict, "attendance.monthPercent", {
            percent:
              s.percent === null
                ? a.noPercent
                : `${localizeDigits(s.percent, lang)}%`,
          })}
        </p>
        <p className="text-muted-foreground text-sm">
          {t(dict, "attendance.monthCounts", {
            present: n(s.present),
            late: n(s.late),
            absent: n(s.absent),
            leave: n(s.leave),
            days: n(s.schoolDays),
          })}
        </p>
      </div>
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{`${title}: ${monthName}`}</caption>
        <thead>
          <tr>
            {ALL_DAYS.map((d) => (
              <th
                key={d}
                scope="col"
                className="py-1 text-center text-xs font-medium"
              >
                <abbr
                  className="no-underline"
                  title={(dict.days as Record<string, string>)[String(d)]}
                >
                  {(dict.days as Record<string, string>)[String(d)]!.slice(
                    0,
                    lang === "bn" ? 2 : 3,
                  )}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week.find(Boolean)}>
              {week.map((date, i) => {
                if (!date) return <td key={`e${i}`} />;
                const status = byDate.get(date);
                const open = isSchoolDay(date, workingDays, holidays);
                const label = status
                  ? a.statuses[status]
                  : open
                    ? ""
                    : holidays.some((h) => h.start <= date && date <= h.end)
                      ? a.holiday
                      : "";
                return (
                  <td key={date} className="p-0.5">
                    <div
                      className={cn(
                        "flex h-12 flex-col items-center justify-center rounded-md text-xs",
                        status
                          ? TONE[status]
                          : open
                            ? "border"
                            : "bg-muted/60 text-muted-foreground",
                        date === today && "ring-primary ring-2",
                      )}
                    >
                      <span className="font-medium">
                        {n(Number(date.slice(8)))}
                      </span>
                      {status ? (
                        <span aria-hidden="true">{a.codes[status]}</span>
                      ) : null}
                      {label ? <span className="sr-only">{label}</span> : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground text-xs">{a.legend}</p>
    </section>
  );
}
