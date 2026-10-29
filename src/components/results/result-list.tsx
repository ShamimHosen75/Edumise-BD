import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatNumber, localizeDigits, pickLocalized } from "@/lib/format";
import type { ResultRecord } from "@/lib/results-data";

/** A student's results, one row per exam, each linking to its mark sheet. */
export function ResultList({
  lang,
  dict,
  rows,
  href,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: ResultRecord[];
  href: (row: ResultRecord) => string;
}) {
  const r = dict.results;
  const statuses = dict.exams.statuses as Record<string, string>;
  if (!rows.length)
    return (
      <p className="text-muted-foreground rounded-xl border p-4 text-sm">
        {r.noResults}
      </p>
    );
  const th = "px-3 py-2 text-left";
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={r.title}
      className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
    >
      <table className="w-full text-sm" data-testid="result-list">
        <caption className="sr-only">{r.title}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className={th}>
              {r.exam}
            </th>
            <th scope="col" className={th}>
              {r.gpa}
            </th>
            <th scope="col" className={th}>
              {r.grade}
            </th>
            <th scope="col" className={th}>
              {r.result}
            </th>
            <th scope="col" className={th}>
              {r.sectionPosition}
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">{r.markSheet}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const exam = pickLocalized(row, "exam", lang);
            return (
              <tr key={row.id} className="border-t">
                <th scope="row" className={`${th} font-medium`}>
                  {exam}
                  {row.examStatus !== "published" ? (
                    <span className="text-muted-foreground block text-xs font-normal">
                      {statuses[row.examStatus]}
                    </span>
                  ) : null}
                </th>
                <td className="px-3 py-2">
                  {formatNumber(row.gpa, lang, { decimals: 2 })}
                </td>
                <td className="px-3 py-2 font-semibold">{row.grade}</td>
                <td className="px-3 py-2">{row.passed ? r.pass : r.fail}</td>
                <td className="px-3 py-2">
                  {localizeDigits(row.section_position, lang)}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={href(row)}
                    className="text-primary font-medium hover:underline"
                    aria-label={r.viewNamed.replace("{name}", exam)}
                  >
                    {r.view}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
