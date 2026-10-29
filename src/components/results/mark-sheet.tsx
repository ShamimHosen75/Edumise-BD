import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatNumber, localizeDigits, pickLocalized } from "@/lib/format";
import type { MarkSheet as Sheet } from "@/lib/results-data";

/**
 * A student's mark sheet: header, subject table (two papers of one subject share their
 * grade), GPA, result, positions, attendance and signature lines. Prints on A4 portrait.
 */
export function MarkSheet({
  lang,
  dict,
  sheet,
  school,
  studentCode,
  photoUrl,
}: {
  lang: Locale;
  dict: Dictionary;
  sheet: Sheet;
  school: { name: string; address: string };
  /** Staff and family views only; never on the public page. */
  studentCode?: string;
  photoUrl?: string | null;
}) {
  const r = dict.results;
  const num = (v: number) => formatNumber(v, lang, { grouping: false });
  const gpa = (v: number) => formatNumber(v, lang, { decimals: 2 });
  const mark = (v: number | null) => (v === null ? "—" : num(v));
  // Rows here have name_en/name_bn style fields (Bangla falls back to English).
  const pick = (row: object, field: string) =>
    pickLocalized(row as { x_en: string; x_bn?: string }, field as "x", lang);
  const group = sheet.group_en ? pick(sheet, "group") : null;
  const parts = (p: string[]) =>
    p.map((x) => r[x as "cq" | "mcq" | "practical"]).join(", ");
  const cell = "border px-2 py-1.5";
  const facts: [string, string][] = [
    [r.name, pick(sheet, "name")],
    ...(studentCode
      ? [
          [dict.students.code, localizeDigits(studentCode, lang)] as [
            string,
            string,
          ],
        ]
      : []),
    [r.class, pick(sheet, "class")],
    [r.section, pick(sheet, "section")],
    ...(group ? [[r.group, group] as [string, string]] : []),
    [r.roll, num(sheet.roll)],
    [r.session, localizeDigits(sheet.session, lang)],
  ];

  return (
    <article
      className="print-sheet bg-background flex flex-col gap-4 rounded-xl border p-4 text-sm print:rounded-none print:border-0 print:p-0"
      aria-label={`${r.markSheet}: ${pick(sheet, "name")}`}
      data-testid="mark-sheet"
    >
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-lg font-semibold">{school.name}</p>
        {school.address ? (
          <p className="text-muted-foreground text-xs">{school.address}</p>
        ) : null}
        <h2 className="mt-1 font-semibold">
          {r.markSheet}: {pick(sheet, "exam")}
        </h2>
      </header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file, short-lived link
          <img
            src={photoUrl}
            alt=""
            className="size-24 rounded border object-cover"
          />
        ) : null}
      </div>
      <div
        role="region"
        tabIndex={0}
        aria-label={r.markSheet}
        className="focus-visible:ring-ring overflow-x-auto outline-none focus-visible:ring-2"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{r.markSheet}</caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className={`${cell} text-left`}>
                {r.subject}
              </th>
              <th scope="col" className={cell}>
                {r.fullMarks}
              </th>
              <th scope="col" className={cell}>
                {r.cq}
              </th>
              <th scope="col" className={cell}>
                {r.mcq}
              </th>
              <th scope="col" className={cell}>
                {r.practical}
              </th>
              <th scope="col" className={cell}>
                {r.obtained}
              </th>
              <th scope="col" className={cell}>
                {r.grade}
              </th>
              <th scope="col" className={cell}>
                {r.point}
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.subjects.flatMap((s) =>
              s.papers.map((p, i) => (
                <tr
                  key={`${s.key}-${i}`}
                  className={s.failed ? "text-destructive" : undefined}
                  data-testid="mark-sheet-row"
                >
                  <th scope="row" className={`${cell} text-left font-normal`}>
                    {pick(p, "name")}
                    {i === 0 && s.role !== "compulsory" ? (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({s.role === "fourth" ? r.fourth : r.extra})
                      </span>
                    ) : null}
                    {i === 0 && s.failed_parts.length ? (
                      <span className="block text-xs">
                        {r.failedParts.replace(
                          "{parts}",
                          parts(s.failed_parts),
                        )}
                      </span>
                    ) : null}
                  </th>
                  <td className={`${cell} text-center`}>{num(p.full)}</td>
                  {p.absent ? (
                    <td colSpan={3} className={`${cell} text-center`}>
                      {r.absent}
                    </td>
                  ) : (
                    <>
                      <td className={`${cell} text-center`}>{mark(p.cq)}</td>
                      <td className={`${cell} text-center`}>{mark(p.mcq)}</td>
                      <td className={`${cell} text-center`}>
                        {mark(p.practical)}
                      </td>
                    </>
                  )}
                  {i === 0 ? (
                    <>
                      <td
                        rowSpan={s.papers.length}
                        className={`${cell} text-center`}
                      >
                        {num(s.obtained)}
                      </td>
                      <td
                        rowSpan={s.papers.length}
                        className={`${cell} text-center font-semibold`}
                      >
                        {s.grade}
                      </td>
                      <td
                        rowSpan={s.papers.length}
                        className={`${cell} text-center`}
                      >
                        {gpa(s.point)}
                      </td>
                    </>
                  ) : null}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <dl
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        data-testid="mark-sheet-summary"
      >
        {(
          [
            [
              r.total,
              r.totalOf
                .replace("{total}", num(sheet.total))
                .replace("{full}", num(sheet.full_total)),
            ],
            [r.gpa, gpa(sheet.gpa)],
            [r.gpaWithoutFourth, gpa(sheet.gpa_without_fourth)],
            [r.grade, sheet.grade],
            [r.result, sheet.passed ? r.pass : r.fail],
            [r.sectionPosition, num(sheet.section_position)],
            [r.classPosition, num(sheet.class_position)],
            [
              r.attendance,
              sheet.attendance_percent === null
                ? "—"
                : `${formatNumber(sheet.attendance_percent, lang)}%`,
            ],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="rounded-lg border p-2">
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-10 hidden grid-cols-3 gap-6 text-center text-xs print:grid">
        {[r.guardianSign, r.classTeacher, r.headTeacher].map((who) => (
          <p key={who} className="border-t pt-1">
            {who}
          </p>
        ))}
      </div>
    </article>
  );
}
