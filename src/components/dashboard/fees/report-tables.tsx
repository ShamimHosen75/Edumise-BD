import type { Locale } from "@/i18n/config";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cellText, type Report } from "@/lib/report-table";

/** A report's tables, readable at 360px (each table scrolls on its own). */
export function ReportTables({
  lang,
  report,
  empty,
}: {
  lang: Locale;
  report: Report;
  empty: string;
}) {
  const money = (p: number) => formatCurrency(p, lang);
  const number = (n: number) => formatNumber(n, lang, { grouping: false });
  const cell = "border-b px-2 py-2";
  return (
    <div className="flex flex-col gap-5" data-testid="report">
      <div>
        <h2 className="text-lg font-semibold">{report.title}</h2>
        <p className="text-muted-foreground text-sm">{report.subtitle}</p>
      </div>
      {report.tables.map((t, n) => (
        <section key={n} className="flex flex-col gap-2" aria-label={t.caption}>
          <h3 className="font-semibold">{t.caption}</h3>
          {t.rows.length ? (
            <div
              role="region"
              tabIndex={0}
              aria-label={t.caption}
              className="overflow-x-auto rounded-lg border"
            >
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    {t.head.map((h, i) => (
                      <th
                        key={i}
                        scope="col"
                        className={`${cell} ${t.kinds[i] === "text" ? "" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td
                          key={j}
                          className={`${cell} ${t.kinds[j] === "text" ? "" : "text-right whitespace-nowrap"}`}
                        >
                          {cellText(v, t.kinds[j]!, money, number)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {t.foot ? (
                  <tfoot>
                    <tr className="font-semibold">
                      {t.foot.map((v, j) => (
                        <td
                          key={j}
                          className={`${cell} ${t.kinds[j] === "text" ? "" : "text-right whitespace-nowrap"}`}
                        >
                          {cellText(v, t.kinds[j]!, money, number)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{empty}</p>
          )}
        </section>
      ))}
    </div>
  );
}
