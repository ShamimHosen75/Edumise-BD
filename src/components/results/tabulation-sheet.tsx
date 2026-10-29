import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatNumber, localizeDigits, pickLocalized } from "@/lib/format";
import type { ResultRecord } from "@/lib/results-data";

/** Section x subjects: marks and grade per subject, total, GPA, result and position. */
export function TabulationSheet({
  lang,
  dict,
  rows,
  title,
  sheetHref,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: ResultRecord[];
  title: string;
  sheetHref: (studentId: number) => string;
}) {
  const r = dict.results;
  const n = (v: number) => formatNumber(v, lang, { grouping: false });
  // Subjects in the order they appear (each student's list is in subject order).
  const subjects = [
    ...new Map(
      rows.flatMap((row) => row.subjects).map((s) => [s.key, s] as const),
    ).values(),
  ];
  const cell = "border px-2 py-1 text-center";
  const sorted = [...rows].sort((a, b) => a.roll - b.roll);
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={title}
      className="focus-visible:ring-ring overflow-x-auto outline-none focus-visible:ring-2"
    >
      <table
        className="w-full border-collapse text-xs"
        data-testid="tabulation"
      >
        <caption className="sr-only">{title}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className={cell}>
              {r.roll}
            </th>
            <th scope="col" className={`${cell} text-left`}>
              {r.name}
            </th>
            {subjects.map((s) => (
              <th key={s.key} scope="col" className={cell}>
                {pickLocalized(s, "name", lang)}
              </th>
            ))}
            <th scope="col" className={cell}>
              {r.total}
            </th>
            <th scope="col" className={cell}>
              {r.gpa}
            </th>
            <th scope="col" className={cell}>
              {r.grade}
            </th>
            <th scope="col" className={cell}>
              {r.result}
            </th>
            <th scope="col" className={cell}>
              {r.position}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={row.passed ? undefined : "text-destructive"}
            >
              <td className={cell}>{localizeDigits(row.roll, lang)}</td>
              <th scope="row" className={`${cell} text-left font-normal`}>
                <Link
                  href={sheetHref(row.studentId)}
                  className="hover:underline print:no-underline"
                >
                  {pickLocalized(row, "name", lang)}
                </Link>
              </th>
              {subjects.map((s) => {
                const got = row.subjects.find((x) => x.key === s.key);
                return (
                  <td key={s.key} className={cell}>
                    {got ? (
                      <>
                        {got.absent ? r.absent : n(got.obtained)}
                        <span className="block font-semibold">{got.grade}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
              <td className={cell}>{n(row.total)}</td>
              <td className={cell}>
                {formatNumber(row.gpa, lang, { decimals: 2 })}
              </td>
              <td className={`${cell} font-semibold`}>{row.grade}</td>
              <td className={cell}>{row.passed ? r.pass : r.fail}</td>
              <td className={cell}>
                {localizeDigits(row.section_position, lang)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
