import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AttendanceHeader } from "@/components/dashboard/attendance/attendance-header";
import { MonthSheet } from "@/components/dashboard/attendance/month-sheet";
import { SectionDateForm } from "@/components/dashboard/attendance/section-date-form";
import { PrintButton } from "@/components/routine/print-button";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { loadSheet, monthLabel } from "./data";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string; month?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).attendance.sheet }
    : {};
}

export default async function AttendanceSheetPage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const dict = await getDictionary(lang);
  const a = dict.attendance;
  const db = await createClient();
  const { frame, sections, section, month, sheet } = await loadSheet(
    db,
    me,
    lang,
    await searchParams,
  );
  const query = section ? `?section=${section.id}&month=${month}` : "";
  const title = section
    ? t(dict, "attendance.sheetTitle", {
        section: section.name,
        month: monthLabel(month, lang),
      })
    : a.sheet;

  return (
    <div className="print-landscape flex flex-col gap-5">
      <AttendanceHeader
        lang={lang}
        dict={dict}
        active="sheet"
        query={section ? `?section=${section.id}` : ""}
      />
      <SectionDateForm
        action={`/${lang}/dashboard/attendance/sheet`}
        sections={sections}
        section={section?.id}
        dateName="month"
        dateType="month"
        dateLabel={a.month}
        dateValue={month}
        max={frame.today.slice(0, 7)}
        labels={{ section: a.section, show: a.show }}
      />
      {sheet && section ? (
        <section aria-label={title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {sheet.rows.length === 0 ? (
            <p className="text-sm">{a.noStudents}</p>
          ) : (
            <MonthSheet lang={lang} dict={dict} sheet={sheet} caption={title} />
          )}
          <p className="text-muted-foreground text-xs">{a.legend}</p>
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton label={a.print} />
            <a
              href={`/${lang}/dashboard/attendance/sheet/export${query}`}
              className={buttonVariants({ variant: "outline" })}
              download
            >
              <FileSpreadsheet aria-hidden="true" />
              {a.export}
            </a>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border p-4 text-sm">{a.noSections}</p>
      )}
    </div>
  );
}
