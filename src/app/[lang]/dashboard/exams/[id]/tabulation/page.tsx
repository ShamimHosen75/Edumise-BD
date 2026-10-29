import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/routine/print-button";
import { TabulationSheet } from "@/components/results/tabulation-sheet";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { examResultOverview, examResults } from "@/lib/results-data";
import { getBranding } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ section?: string }>;
};

const ID = /^[1-9][0-9]{0,15}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).results.tabulation }
    : {};
}

/** Tabulation sheet of one section (admins; the exams layout checks the role). */
export default async function TabulationPage({ params, searchParams }: Props) {
  const { lang, id: raw } = await params;
  if (!isLocale(lang) || !ID.test(raw)) notFound();
  const id = Number(raw);
  const dict = await getDictionary(lang);
  const r = dict.results;
  const db = await createClient();
  const [{ sections }, { name: school }] = await Promise.all([
    examResultOverview(db, id),
    getBranding(lang, dict),
  ]);
  if (!sections.length) notFound();
  const wanted = (await searchParams).section;
  const section =
    sections.find((s) => String(s.sectionId) === wanted) ?? sections[0]!;
  // Only this section's full rows (with every subject) are loaded.
  const rows = await examResults(db, id, section.sectionId);
  if (!rows.length) notFound();
  const label = (x: (typeof sections)[number]) =>
    `${pickLocalized(x, "class", lang)} ${pickLocalized(x, "name", lang)}`;
  const base = `/${lang}/dashboard/exams/${id}`;
  const title = `${pickLocalized(rows[0]!, "exam", lang)} · ${label(section)}`;

  return (
    <div className="print-landscape flex flex-col gap-4">
      <Link
        href={`${base}?tab=results`}
        className="text-primary text-sm hover:underline print:hidden"
      >
        <span aria-hidden="true">←</span> {r.back}
      </Link>
      <div className="flex flex-col gap-1 text-center">
        <p className="font-semibold">{school}</p>
        <h1 className="text-xl font-semibold">
          {r.tabulationOf.replace("{section}", title)}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <TabLinks
          label={r.sections}
          tabs={sections.map((s) => ({
            href: `${base}/tabulation?section=${s.sectionId}`,
            label: label(s),
            active: s.sectionId === section.sectionId,
          }))}
        />
        <PrintButton label={r.print} />
      </div>
      <TabulationSheet
        lang={lang}
        dict={dict}
        rows={rows}
        title={title}
        sheetHref={(studentId) => `${base}/results/${studentId}`}
      />
    </div>
  );
}
