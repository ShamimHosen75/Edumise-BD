import Link from "next/link";

import { PrintButton } from "@/components/routine/print-button";
import { MarkSheet } from "@/components/results/mark-sheet";
import { ResultList } from "@/components/results/result-list";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { studentResults } from "@/lib/results-data";
import { sheetHeader } from "@/lib/school";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * A student's or child's results (portal): the list, or one mark sheet with ?exam=.
 * RLS returns published exams only.
 */
export async function StudentResultsPage({
  db,
  lang,
  dict,
  studentId,
  name,
  code,
  base,
  exam,
}: {
  db: Client;
  lang: Locale;
  dict: Dictionary;
  studentId: number;
  name: string;
  code: string;
  base: string;
  exam?: string;
}) {
  const rows = (await studentResults(db, studentId)).filter(
    (r) => r.examStatus === "published",
  );
  const sheet = exam ? rows.find((r) => String(r.examId) === exam) : undefined;
  if (sheet)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link href={base} className="text-primary text-sm hover:underline">
            <span aria-hidden="true">←</span> {dict.results.title}
          </Link>
          <PrintButton label={dict.results.print} />
        </div>
        <MarkSheet
          lang={lang}
          dict={dict}
          sheet={sheet}
          school={await sheetHeader(lang, dict)}
          studentCode={code}
        />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{dict.results.title}</h1>
        <p className="text-muted-foreground text-sm">{name}</p>
      </div>
      <ResultList
        lang={lang}
        dict={dict}
        rows={rows}
        href={(r) => `${base}?exam=${r.examId}`}
      />
    </div>
  );
}
