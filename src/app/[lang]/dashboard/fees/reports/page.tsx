import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { ReportFilters } from "@/components/dashboard/fees/report-filters";
import { ReportTables } from "@/components/dashboard/fees/report-tables";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { buildReport, filterQuery, readFilters, REPORTS } from "./load";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.reports.title }
    : {};
}

/** Daily collection, dues, income by fee head and a student's ledger; Excel and PDF. */
export default async function ReportsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.fees.reports;
  const db = await createClient();
  const f = await readFilters(db, await searchParams);
  const [report, { data: classes }, { data: sections }] = await Promise.all([
    buildReport(db, f, lang, dict),
    db.from("classes").select("id, name_en, name_bn").order("level"),
    db
      .from("sections")
      .select("id, class_id, name_en, name_bn")
      .order("name_en"),
  ]);
  const base = `/${lang}/dashboard/fees/reports`;
  const exportBase = `${base}/export?${filterQuery(f)}`;
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="reports" />
      <TabLinks
        label={r.title}
        tabs={REPORTS.map((k) => ({
          href: `${base}?report=${k}`,
          label: r[k].title,
          active: k === f.kind,
        }))}
      />
      <ReportFilters
        lang={lang}
        dict={dict}
        filters={f}
        action={base}
        classes={(classes ?? []).map((c) => ({
          id: c.id,
          name: pickLocalized(c, "name", lang),
        }))}
        sections={(sections ?? [])
          .filter((s) => !f.classId || s.class_id === f.classId)
          .map((s) => ({ id: s.id, name: pickLocalized(s, "name", lang) }))}
      />
      {report ? (
        <>
          <div className="flex flex-wrap gap-4 text-sm print:hidden">
            <a
              href={`${exportBase}&format=xlsx`}
              className="text-primary font-medium hover:underline"
            >
              {r.excel}
            </a>
            <a
              href={`${exportBase}&format=pdf`}
              className="text-primary font-medium hover:underline"
            >
              {r.pdf}
            </a>
          </div>
          <ReportTables lang={lang} report={report} empty={r.empty} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {f.kind === "ledger" && f.code ? r.ledger.notFound : r.ledger.pick}
        </p>
      )}
    </div>
  );
}
