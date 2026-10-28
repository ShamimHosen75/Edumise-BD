import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { AttendanceStatus } from "@/lib/attendance";
import type { Sheet } from "@/lib/attendance-sheet";
import { localizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<AttendanceStatus, string> = {
  present: "text-primary",
  absent: "text-destructive font-semibold",
  late: "text-amber-700 dark:text-amber-300",
  leave: "text-sky-700 dark:text-sky-300",
};

/** Students down the side, days across, then totals and %. Prints on A4 landscape. */
export function MonthSheet({
  lang,
  dict,
  sheet,
  caption,
}: {
  lang: Locale;
  dict: Dictionary;
  sheet: Sheet;
  caption: string;
}) {
  const a = dict.attendance;
  const n = (v: number) => localizeDigits(v, lang);
  const th = "px-1 py-1 text-center font-medium";
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={caption}
      className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2 print:overflow-visible print:border-0"
    >
      <table className="w-full border-collapse text-xs print:text-[8px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className={th}>
              {a.roll}
            </th>
            <th scope="col" className="px-2 py-1 text-left font-medium">
              {a.name}
            </th>
            {sheet.dates.map((d) => (
              <th key={d} scope="col" className={cn(th, "min-w-6")}>
                {n(Number(d.slice(8)))}
              </th>
            ))}
            {(["present", "absent", "late", "leave"] as const).map((s) => (
              <th key={s} scope="col" className={th} title={a.statuses[s]}>
                {a.codes[s]}
              </th>
            ))}
            <th scope="col" className={th}>
              {a.percent}
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r) => (
            <tr key={r.studentId} className="border-t">
              <td className="px-1 py-1 text-center">{n(r.roll)}</td>
              <th
                scope="row"
                className="max-w-40 truncate px-2 py-1 text-left font-normal"
              >
                {r.name}
              </th>
              {sheet.dates.map((d) => {
                const s = r.days[d];
                return (
                  <td
                    key={d}
                    className={cn(
                      "border-l px-1 py-1 text-center",
                      !sheet.open.has(d) && "bg-muted/60",
                      s && TONE[s],
                    )}
                  >
                    {s ? a.codes[s] : ""}
                  </td>
                );
              })}
              <td className="border-l px-1 py-1 text-center">
                {n(r.summary.present)}
              </td>
              <td className="px-1 py-1 text-center">{n(r.summary.absent)}</td>
              <td className="px-1 py-1 text-center">{n(r.summary.late)}</td>
              <td className="px-1 py-1 text-center">{n(r.summary.leave)}</td>
              <td className="px-1 py-1 text-center font-medium">
                {r.summary.percent === null
                  ? a.noPercent
                  : localizeDigits(r.summary.percent, lang)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
