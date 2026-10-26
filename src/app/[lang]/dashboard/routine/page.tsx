import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoutineBuilder } from "@/components/dashboard/routine/routine-builder";
import { RoutineHeader } from "@/components/dashboard/routine/routine-header";
import { ChoiceForm } from "@/components/routine/choice-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { academicData } from "@/lib/academic-data";
import { localizeDigits, pickLocalized } from "@/lib/format";
import {
  classSubjectOptions,
  routineEntries,
  routineFrame,
} from "@/lib/routine-data";
import { routineMessages } from "@/lib/routine-messages";
import { sectionOptions } from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).routine.title }
    : {};
}

export default async function RoutinePage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.routine;
  const db = await createClient();
  const [frame, sections, teachers, rooms] = await Promise.all([
    routineFrame(db),
    sectionOptions(db, lang),
    academicData.teachers(db, lang),
    academicData.rooms(db),
  ]);
  const wanted = (await searchParams).section;
  const section = sections.find((s) => String(s.id) === wanted) ?? sections[0];
  const { session, periods, workingDays } = frame;

  const header = (
    <>
      <RoutineHeader lang={lang} dict={dict} active="section" intro={r.intro} />
      <ChoiceForm
        action={`/${lang}/dashboard/routine`}
        name="section"
        label={r.section}
        submit={r.show}
        options={sections}
        value={section?.id}
      />
    </>
  );
  const message = !session ? r.noSession : periods.length ? null : r.noPeriods;
  if (message || !session || !section)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-muted-foreground rounded-xl border p-4 text-sm">
          {message ?? r.noClasses}
        </p>
      </div>
    );

  const [entries, classSubjects] = await Promise.all([
    routineEntries(db, session.id, lang),
    classSubjectOptions(db, section.classId, lang),
  ]);
  const all = entries.filter((e) => e.sectionId === section.id);
  // Classes on a day the school no longer opens, or in a period that is now a break,
  // cannot be shown or saved: they are left out and removed on the next save.
  const classPeriods = new Set(
    periods.filter((p) => !p.is_break).map((p) => p.id),
  );
  const mine = all.filter(
    (e) => workingDays.includes(e.day) && classPeriods.has(e.periodId),
  );
  const dropped = all.length - mine.length;
  // A subject already in the routine stays choosable even if the class list changed.
  const subjects = [
    ...classSubjects,
    ...mine
      .filter((e) => !classSubjects.some((s) => s.id === e.subjectId))
      .map((e) => ({ id: e.subjectId, name: e.subject })),
  ];

  return (
    <div className="print-landscape flex flex-col gap-6">
      {header}
      <h2 className="text-lg font-semibold">
        {t(dict, "routine.printTitle", {
          name: section.name,
          session: localizeDigits(session.name, lang),
        })}
      </h2>
      {dropped > 0 ? (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {t(dict, "routine.dropped", { count: localizeDigits(dropped, lang) })}
        </p>
      ) : null}
      <RoutineBuilder
        key={section.id}
        lang={lang}
        sessionId={session.id}
        sectionId={section.id}
        periods={periods}
        workingDays={workingDays}
        initial={mine.map((e) => ({
          day: e.day,
          periodId: e.periodId,
          subjectId: e.subjectId,
          staffId: e.staffId,
          roomId: e.roomId,
        }))}
        others={entries
          .filter((e) => e.sectionId !== section.id)
          .map((e) => ({
            day: e.day,
            periodId: e.periodId,
            subjectId: e.subjectId,
            staffId: e.staffId,
            roomId: e.roomId,
            sectionId: e.sectionId,
            section: e.section,
          }))}
        subjects={subjects}
        teachers={[
          ...teachers.map((x) => ({
            id: x.id,
            name: pickLocalized(x, "name", lang),
          })),
          // Teachers who have left stay choosable for the classes they still have.
          ...mine
            .filter(
              (e) => e.staffId && !teachers.some((x) => x.id === e.staffId),
            )
            .map((e) => ({ id: e.staffId!, name: e.teacher }))
            .filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i),
        ]}
        rooms={rooms}
        messages={routineMessages(dict)}
      />
    </div>
  );
}
