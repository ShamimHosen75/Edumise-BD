import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/routine/print-button";
import { MarkSheet } from "@/components/results/mark-sheet";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { studentResults } from "@/lib/results-data";
import { sheetHeader } from "@/lib/school";
import { signed } from "@/lib/student-detail";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ lang: string; id: string; studentId: string }>;
};

const ID = /^[1-9][0-9]{0,15}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).results.markSheet }
    : {};
}

/** One student's mark sheet for the office: print it, or download the PDF. */
export default async function StudentMarkSheetPage({ params }: Props) {
  const { lang, id, studentId } = await params;
  if (!isLocale(lang) || !ID.test(id) || !ID.test(studentId)) notFound();
  const dict = await getDictionary(lang);
  const db = await createClient();
  const sheet = (await studentResults(db, Number(studentId))).find(
    (x) => x.examId === Number(id),
  );
  if (!sheet) notFound();
  const [school, photoUrl] = await Promise.all([
    sheetHeader(lang, dict),
    signed(db, sheet.photoPath),
  ]);
  const base = `/${lang}/dashboard/exams/${id}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`${base}/tabulation?section=${sheet.sectionId}`}
          className="text-primary text-sm hover:underline"
        >
          <span aria-hidden="true">←</span> {dict.results.tabulation}
        </Link>
        <PrintButton label={dict.results.print} />
        <a
          href={`${base}/results/${studentId}/pdf`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <FileDown aria-hidden="true" />
          {dict.results.downloadPdf}
        </a>
        <p className="text-muted-foreground text-xs">{dict.results.pdfNote}</p>
      </div>
      <MarkSheet
        lang={lang}
        dict={dict}
        sheet={sheet}
        school={school}
        studentCode={sheet.studentCode}
        photoUrl={photoUrl}
      />
    </div>
  );
}
