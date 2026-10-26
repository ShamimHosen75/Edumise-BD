import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/routine/print-button";
import { ContentHeader } from "@/components/site/content/content-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatDate, localizeDigits } from "@/lib/format";
import { hhmm } from "@/lib/routine";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { getExamRoutines } from "@/lib/site/routine-data";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/exam-routine"),
    title: dict.examSchedule.publicTitle,
    description: dict.examSchedule.publicIntro,
  };
}

export default async function ExamRoutinePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const e = dict.examSchedule;
  const exams = await getExamRoutines(lang);
  const days = dict.days as Record<string, string>;
  const time = (v: string) => localizeDigits(hhmm(v), lang);
  const th = "px-3 py-2 text-left";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 print:p-0">
      <ContentHeader title={e.publicTitle} intro={e.publicIntro} />
      {exams.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {e.none}
        </p>
      ) : (
        exams.map((exam) => (
          <section
            key={exam.id}
            aria-labelledby={`exam-${exam.id}`}
            className="flex flex-col gap-4"
          >
            <h2 id={`exam-${exam.id}`} className="text-xl font-semibold">
              {exam.name}
            </h2>
            {exam.classes.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                <div
                  role="region"
                  tabIndex={0}
                  aria-label={`${exam.name}: ${c.name}`}
                  className="focus-visible:ring-ring overflow-x-auto rounded-xl border outline-none focus-visible:ring-2"
                >
                  <table className="w-full text-sm">
                    <caption className="sr-only">{`${exam.name}: ${c.name}`}</caption>
                    <thead className="bg-muted">
                      <tr>
                        <th scope="col" className={th}>
                          {e.date}
                        </th>
                        <th scope="col" className={th}>
                          {e.day}
                        </th>
                        <th scope="col" className={th}>
                          {e.subject}
                        </th>
                        <th scope="col" className={th}>
                          {e.time}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.papers.map((p, n) => (
                        <tr key={n} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDate(p.date, lang, "medium")}
                          </td>
                          <td className="px-3 py-2">
                            {
                              days[
                                String(
                                  new Date(`${p.date}T00:00:00Z`).getUTCDay(),
                                )
                              ]
                            }
                          </td>
                          <td className="px-3 py-2">{p.subject}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {time(p.startsAt)}–{time(p.endsAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        ))
      )}
      {exams.length ? <PrintButton label={dict.routine.print} /> : null}
    </div>
  );
}
