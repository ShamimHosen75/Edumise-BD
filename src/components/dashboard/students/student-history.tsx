import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localizeDigits } from "@/lib/format";
import type { HistoryRow } from "@/lib/student-detail";

/** One row per session the student was enrolled in, newest first. */
export function StudentHistory({
  lang,
  dict,
  rows,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: HistoryRow[];
}) {
  const p = dict.studentProfile;
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">{p.historyEmpty}</p>;
  return (
    <div className="max-w-4xl overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{p.history}</caption>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2">
              {p.historySession}
            </th>
            <th scope="col" className="px-3 py-2">
              {p.historyClass}
            </th>
            <th scope="col" className="px-3 py-2">
              {p.historySection}
            </th>
            <th scope="col" className="px-3 py-2">
              {p.group}
            </th>
            <th scope="col" className="px-3 py-2">
              {p.historyRoll}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{localizeDigits(r.session, lang)}</td>
              <td className="px-3 py-2">{r.className}</td>
              <td className="px-3 py-2">{r.section}</td>
              <td className="px-3 py-2">{r.group || "—"}</td>
              <td className="px-3 py-2">{localizeDigits(r.roll, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
