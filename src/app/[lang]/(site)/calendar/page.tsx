import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthGrid } from "@/components/routine/month-grid";
import { ContentHeader } from "@/components/site/content/content-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { isMonth, shiftMonth } from "@/lib/routine";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getCalendarMonth, getRoutineFrame } from "@/lib/site/routine-data";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ month?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/calendar"),
    title: dict.calendar.title,
    description: dict.calendar.intro,
  };
}

export default async function CalendarPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.calendar;
  const wanted = (await searchParams).month;
  const today = dhakaToday();
  const month = isMonth(wanted) ? wanted : today.slice(0, 7);
  const [items, { workingDays }] = await Promise.all([
    getCalendarMonth(month, lang),
    getRoutineFrame(lang),
  ]);
  const title = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const base = `/${lang}/calendar`;
  const nav = "hover:bg-accent rounded-md border px-3 py-2 text-sm";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.title} intro={c.intro} />
      <nav
        aria-label={c.month}
        className="flex items-center justify-between gap-3"
      >
        <Link href={`${base}?month=${shiftMonth(month, -1)}`} className={nav}>
          <span aria-hidden="true">←</span> {c.prev}
        </Link>
        <h2 className="text-lg font-semibold" data-testid="calendar-month">
          {title}
        </h2>
        <Link href={`${base}?month=${shiftMonth(month, 1)}`} className={nav}>
          {c.next} <span aria-hidden="true">→</span>
        </Link>
      </nav>
      <MonthGrid
        lang={lang}
        month={month}
        today={today}
        items={items}
        workingDays={workingDays}
        labels={{
          caption: title,
          dayName: (d) =>
            (dict.days as Record<string, string>)[String(d)] ?? "",
          holiday: c.holiday,
          closed: c.closed,
        }}
      />
      <section aria-labelledby="calendar-list" className="flex flex-col gap-3">
        <h2 id="calendar-list" className="font-semibold">
          {c.list}
        </h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{c.none}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="calendar-items">
            {items.map((i) => (
              <li
                key={`${i.kind}-${i.start}-${i.title}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border p-3 text-sm"
              >
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    i.kind === "holiday"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {i.kind === "holiday" ? c.holiday : c.event}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(i.start, lang, "medium")}
                  {i.end !== i.start
                    ? ` – ${formatDate(i.end, lang, "medium")}`
                    : ""}
                </span>
                {i.href ? (
                  <Link href={i.href} className="font-medium hover:underline">
                    {i.title}
                  </Link>
                ) : (
                  <span className="font-medium">{i.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
