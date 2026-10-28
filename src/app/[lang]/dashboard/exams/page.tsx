import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExamsManager } from "@/components/dashboard/exams/exams-manager";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { sessionExams } from "@/lib/exams-data";
import { examsMessages } from "@/lib/exams-messages";
import { classChoices } from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).exams.title }
    : {};
}

export default async function ExamsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const db = await createClient();
  const [rows, classes] = await Promise.all([
    sessionExams(db, lang),
    classChoices(db, lang),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{dict.exams.title}</h1>
        <p className="text-muted-foreground text-sm">{dict.exams.intro}</p>
      </div>
      <ExamsManager
        lang={lang}
        rows={rows}
        classes={classes}
        messages={examsMessages(dict)}
      />
    </div>
  );
}
