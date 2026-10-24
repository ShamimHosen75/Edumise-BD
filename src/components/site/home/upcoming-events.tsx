import { MapPin } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  formatWeekdayTime,
  pickLocalized,
  SCHOOL_TIME_ZONE,
} from "@/lib/format";

import { Section } from "./section";

export type EventRow = {
  id: number;
  title_en: string;
  title_bn: string;
  venue_en: string;
  venue_bn: string;
  starts_at: string;
};

function dateParts(iso: string, lang: Locale) {
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const opts = { timeZone: SCHOOL_TIME_ZONE } as const;
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(locale, { ...opts, day: "numeric" }).format(
      date,
    ),
    month: new Intl.DateTimeFormat(locale, { ...opts, month: "short" }).format(
      date,
    ),
    time: formatWeekdayTime(date, lang),
  };
}

export function UpcomingEvents({
  lang,
  dict,
  events,
}: {
  lang: Locale;
  dict: Dictionary;
  events: EventRow[];
}) {
  if (events.length === 0) return null;
  return (
    <Section id="events" title={dict.site.home.events}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => {
          const d = dateParts(e.starts_at, lang);
          const venue = pickLocalized(e, "venue", lang);
          return (
            <li key={e.id} className="bg-card flex gap-4 rounded-xl border p-4">
              <time
                dateTime={e.starts_at}
                className="bg-primary text-primary-foreground flex w-14 shrink-0 flex-col items-center justify-center rounded-lg"
              >
                <span className="text-xl leading-none font-bold">{d.day}</span>
                <span className="text-xs">{d.month}</span>
              </time>
              <div className="min-w-0">
                <p className="font-semibold">
                  {pickLocalized(e, "title", lang)}
                </p>
                <p className="text-muted-foreground text-xs">{d.time}</p>
                {venue ? (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <MapPin className="size-3" aria-hidden="true" />
                    {venue}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
