import type { Locale } from "@/i18n/config";
import { localizeDigits } from "@/lib/format";
import { monthGrid, weekDays } from "@/lib/routine";
import type { CalendarItem } from "@/lib/site/routine-data";
import { cn } from "@/lib/utils";

const ALL = weekDays([0, 1, 2, 3, 4, 5, 6]);

/** A month, Saturday first. Holidays and closed days are shaded; events are listed. */
export function MonthGrid({
  lang,
  month,
  today,
  items,
  workingDays,
  labels,
}: {
  lang: Locale;
  month: string;
  today: string;
  items: CalendarItem[];
  workingDays: number[];
  labels: {
    caption: string;
    dayName: (day: number) => string;
    holiday: string;
    closed: string;
  };
}) {
  const on = (date: string) =>
    items.filter((i) => i.start <= date && date <= i.end);
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={labels.caption}
      className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
    >
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{labels.caption}</caption>
        <thead className="bg-muted">
          <tr>
            {ALL.map((d) => (
              <th key={d} scope="col" className="px-2 py-2 text-left">
                {labels.dayName(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week.find(Boolean)} className="border-t">
              {week.map((date, i) => {
                if (!date)
                  return (
                    <td key={`empty-${i}`} className="bg-muted/30 border-l" />
                  );
                const here = on(date);
                const holiday = here.some((x) => x.kind === "holiday");
                const closed = !workingDays.includes(ALL[i]!);
                return (
                  <td
                    key={date}
                    className={cn(
                      "h-20 border-l p-1 align-top",
                      (holiday || closed) && "bg-destructive/5",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs",
                        date === today && "bg-primary text-primary-foreground",
                        (holiday || closed) &&
                          date !== today &&
                          "text-destructive",
                      )}
                      aria-current={date === today ? "date" : undefined}
                    >
                      {localizeDigits(Number(date.slice(8)), lang)}
                    </span>
                    {closed && !holiday ? (
                      <span className="sr-only">{labels.closed}</span>
                    ) : null}
                    {here.map((x, n) => (
                      <span
                        key={`${n}-${x.kind}`}
                        className={cn(
                          "mt-0.5 block truncate rounded px-1 text-xs",
                          x.kind === "holiday"
                            ? "text-destructive"
                            : "bg-primary/10 text-primary",
                        )}
                        title={x.title}
                      >
                        {x.title}
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
