import { hhmm, slotKey, weekDays } from "@/lib/routine";
import type { Period } from "@/lib/routine-data";
import { cn } from "@/lib/utils";

export type GridLabels = {
  caption: string;
  day: string;
  /** Column title of a class period ("Period 1"). */
  period: (p: Period) => string;
  breakLabel: string;
  dayName: (day: number) => string;
  time: (value: string) => string;
};

/**
 * Days down the side, periods across the top (the usual A4 landscape layout). Each cell
 * is drawn by the caller; break periods are one shaded column.
 */
export function RoutineGrid({
  periods,
  workingDays,
  labels,
  cell,
  className,
}: {
  periods: Period[];
  workingDays: readonly number[];
  labels: GridLabels;
  cell: (day: number, period: Period, key: string) => React.ReactNode;
  className?: string;
}) {
  const days = weekDays(workingDays);
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={labels.caption}
      className={cn(
        "focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2 print:overflow-visible",
        className,
      )}
    >
      <table className="w-full min-w-[44rem] border-collapse text-sm print:min-w-0 print:text-xs">
        <caption className="sr-only">{labels.caption}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="w-24 px-2 py-2 text-left">
              {labels.day}
            </th>
            {periods.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="border-l px-2 py-2 text-left align-top"
              >
                <span className="block">
                  {p.is_break ? labels.breakLabel : labels.period(p)}
                </span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {labels.time(hhmm(p.starts_at))}–
                  {labels.time(hhmm(p.ends_at))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className="border-t">
              <th
                scope="row"
                className="px-2 py-2 text-left align-top font-medium"
              >
                {labels.dayName(day)}
              </th>
              {periods.map((p) =>
                p.is_break ? (
                  <td
                    key={p.id}
                    className="bg-muted/60 border-l"
                    aria-label={labels.breakLabel}
                  />
                ) : (
                  <td key={p.id} className="border-l p-1 align-top">
                    {cell(day, p, slotKey(day, p.id))}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Subject, teacher (or section) and room of one class, small. */
export function EntryText({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <span className="flex flex-col px-1 py-0.5 text-left leading-tight">
      <span className="font-medium">{title}</span>
      {lines.filter(Boolean).map((l) => (
        <span key={l} className="text-muted-foreground text-xs">
          {l}
        </span>
      ))}
    </span>
  );
}
