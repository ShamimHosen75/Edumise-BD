import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { PassRateChart } from "@/components/site/pass-rate-chart";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatNumber, localizeDigits } from "@/lib/format";
import { passRate } from "@/lib/site/chart";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getBoardResults } from "@/lib/site/result-data";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/board-results"),
    title: dict.boardResults.title,
    description: dict.boardResults.intro,
  };
}

/** Board exam results by year (WEB-11): a table per exam and its pass-rate chart. */
export default async function BoardResultsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const b = dict.boardResults;
  const rows = await getBoardResults();
  const exams = (["ssc", "jsc"] as const).filter((e) =>
    rows.some((r) => r.exam === e),
  );
  const n = (v: number) => localizeDigits(v, lang);
  const th = "px-3 py-2 text-left";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <ContentHeader title={b.title} intro={b.intro} />
      {exams.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {b.none}
        </p>
      ) : (
        exams.map((exam) => {
          const list = rows.filter((r) => r.exam === exam);
          const name = b.exams[exam];
          return (
            <section
              key={exam}
              aria-labelledby={`board-${exam}`}
              className="flex flex-col gap-4"
            >
              <h2 id={`board-${exam}`} className="text-xl font-semibold">
                {name}
              </h2>
              <PassRateChart
                lang={lang}
                title={b.chartOf.replace("{exam}", name)}
                points={list.map((r) => ({
                  year: r.year,
                  rate: passRate(r.passed, r.examinees),
                }))}
              />
              <div
                role="region"
                tabIndex={0}
                aria-label={name}
                className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
              >
                <table className="w-full text-sm" data-testid="board-results">
                  <caption className="sr-only">{`${b.title}: ${name}`}</caption>
                  <thead className="bg-muted">
                    <tr>
                      {[b.year, b.examinees, b.passed, b.passRate, b.gpa5].map(
                        (h) => (
                          <th key={h} scope="col" className={th}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...list].reverse().map((r) => (
                      <tr key={r.id} className="border-t">
                        <th scope="row" className={`${th} font-medium`}>
                          {n(r.year)}
                        </th>
                        <td className="px-3 py-2">{n(r.examinees)}</td>
                        <td className="px-3 py-2">{n(r.passed)}</td>
                        <td className="px-3 py-2">
                          {formatNumber(passRate(r.passed, r.examinees), lang)}%
                        </td>
                        <td className="px-3 py-2">{n(r.gpa5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
