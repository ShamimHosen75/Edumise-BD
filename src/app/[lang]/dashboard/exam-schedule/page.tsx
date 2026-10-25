import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ExamScheduleManager,
  type PaperRow,
} from "@/components/dashboard/routine/exam-schedule-manager";
import { PublishSchedule } from "@/components/dashboard/routine/publish-schedule";
import { ChoiceForm } from "@/components/routine/choice-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { academicData } from "@/lib/academic-data";
import { pickLocalized } from "@/lib/format";
import { routineMessages } from "@/lib/routine-messages";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ exam?: string }>;
};
type Named = { name_en: string; name_bn: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).examSchedule.title }
    : {};
}

export default async function ExamSchedulePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const e = dict.examSchedule;
  const db = await createClient();
  const [{ data: exams }, classes, subjects] = await Promise.all([
    db
      .from("exams")
      .select(
        "id, name_en, name_bn, schedule_published, session:academic_sessions!inner(is_current)",
      )
      .eq("session.is_current", true)
      .order("starts_on"),
    academicData.classList(db),
    academicData.subjects(db),
  ]);
  const list = (exams ?? []).map((x) => ({
    ...x,
    name: pickLocalized(x, "name", lang),
  }));
  const wanted = (await searchParams).exam;
  const exam = list.find((x) => String(x.id) === wanted) ?? list[0];

  let rows: PaperRow[] = [];
  if (exam) {
    const { data, error } = await db
      .from("exam_schedule")
      .select(
        "id, exam_id, class_id, subject_id, exam_date, starts_at, ends_at, class:classes(level, name_en, name_bn), subject:subjects(name_en, name_bn)",
      )
      .eq("exam_id", exam.id);
    if (error) throw new Error(error.message);
    rows = (data ?? []).map(({ class: c, subject, ...r }) => {
      const cls = c as unknown as Named & { level: number };
      return {
        ...r,
        className: pickLocalized(cls, "name", lang),
        level: cls.level,
        subject: pickLocalized(subject as unknown as Named, "name", lang),
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{e.title}</h1>
        <p className="text-muted-foreground text-sm">{e.intro}</p>
      </div>
      {exam ? (
        <>
          <ChoiceForm
            action={`/${lang}/dashboard/exam-schedule`}
            name="exam"
            label={e.exam}
            submit={e.show}
            options={list}
            value={exam.id}
          />
          <PublishSchedule
            lang={lang}
            examId={exam.id}
            published={exam.schedule_published}
            labels={{
              published: e.published,
              notPublished: e.notPublished,
              publish: e.publish,
              unpublish: e.unpublish,
              failed: dict.errors.notAllowed,
            }}
          />
          <ExamScheduleManager
            key={exam.id}
            lang={lang}
            examId={exam.id}
            rows={rows}
            classes={classes.map((c) => ({
              id: c.id,
              name: pickLocalized(c, "name", lang),
            }))}
            subjects={subjects.map((s) => ({
              id: s.id,
              name: pickLocalized(s, "name", lang),
            }))}
            messages={routineMessages(dict)}
          />
        </>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {e.noExams}
        </p>
      )}
    </div>
  );
}
