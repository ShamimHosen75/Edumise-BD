import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExamCompletion } from "@/components/dashboard/exams/exam-completion";
import { ExamResults } from "@/components/dashboard/exams/exam-results";
import { ExamStatus } from "@/components/dashboard/exams/exam-status";
import { ExamSubjects } from "@/components/dashboard/exams/exam-subjects";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { examCompletion, examSubjects, sessionExams } from "@/lib/exams-data";
import { examsMessages } from "@/lib/exams-messages";
import { formatDate, pickLocalized } from "@/lib/format";
import { resultSummary } from "@/lib/results-build";
import { examResultOverview, resultsState } from "@/lib/results-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).exams.title }
    : {};
}

export default async function ExamPage({ params, searchParams }: Props) {
  const { lang, id: raw } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
  if (!isLocale(lang) || id === null) notFound();
  const wanted = (await searchParams).tab;
  const tab =
    wanted === "completion" || wanted === "results" ? wanted : "subjects";
  const dict = await getDictionary(lang);
  const e = dict.exams;
  const db = await createClient();
  const exam = (await sessionExams(db, lang)).find((x) => x.id === id);
  if (!exam) notFound();
  const messages = examsMessages(dict);
  const base = `/${lang}/dashboard/exams/${id}`;

  let body: React.ReactNode;
  if (tab === "results") {
    const [overview, state] = await Promise.all([
      examResultOverview(db, id),
      resultsState(db, id),
    ]);
    const sections = overview.sections.map((s) => ({
      id: s.sectionId,
      name: `${pickLocalized(s, "class", lang)} ${pickLocalized(s, "name", lang)}`,
      students: s.students,
    }));
    body = (
      <ExamResults
        lang={lang}
        examId={id}
        status={exam.status}
        processedAt={state.processedAt}
        current={state.current}
        summary={resultSummary(overview.rows)}
        sections={sections}
        messages={messages}
      />
    );
  } else if (tab === "completion") {
    body = (
      <ExamCompletion
        lang={lang}
        examId={id}
        rows={await examCompletion(db, id, lang)}
        messages={messages}
      />
    );
  } else {
    const [rows, { data: classes }, { data: taught }] = await Promise.all([
      examSubjects(db, id, lang),
      db
        .from("classes")
        .select("id, level, name_en, name_bn")
        .in("id", exam.classIds)
        .order("level"),
      db
        .from("class_subjects")
        .select("class_id, subject:subjects(id, name_en, name_bn, sort_order)")
        .in("class_id", exam.classIds),
    ]);
    body = (classes ?? []).map((c) => {
      const options = [
        ...new Map(
          (taught ?? [])
            .filter((t) => t.class_id === c.id)
            .map((t) => {
              const s = t.subject as unknown as {
                id: number;
                name_en: string;
                name_bn: string;
                sort_order: number;
              };
              return [s.id, s] as const;
            }),
        ).values(),
      ]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ id: s.id, name: pickLocalized(s, "name", lang) }));
      return (
        <ExamSubjects
          key={c.id}
          lang={lang}
          examId={id}
          cls={{ id: c.id, name: pickLocalized(c, "name", lang) }}
          rows={rows.filter((r) => r.class_id === c.id)}
          subjects={options}
          messages={messages}
        />
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${lang}/dashboard/exams`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span> {e.back}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{exam.name}</h1>
        <p className="text-muted-foreground text-sm">
          {exam.classes}
          {exam.starts_on
            ? ` · ${formatDate(exam.starts_on, lang, "medium")}${exam.ends_on ? ` – ${formatDate(exam.ends_on, lang, "medium")}` : ""}`
            : ""}
        </p>
      </div>
      <ExamStatus
        lang={lang}
        examId={id}
        status={exam.status}
        messages={messages}
      />
      <TabLinks
        label={e.tabs}
        tabs={[
          { href: base, label: e.subjects, active: tab === "subjects" },
          {
            href: `${base}?tab=completion`,
            label: e.completion,
            active: tab === "completion",
          },
          {
            href: `${base}?tab=results`,
            label: dict.results.tab,
            active: tab === "results",
          },
        ]}
      />
      {body}
    </div>
  );
}
