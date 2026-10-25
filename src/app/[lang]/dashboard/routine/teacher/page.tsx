import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoutineHeader } from "@/components/dashboard/routine/routine-header";
import { ChoiceForm } from "@/components/routine/choice-form";
import { TeacherRoutine } from "@/components/routine/teacher-routine";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { academicData } from "@/lib/academic-data";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ staff?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).routine.byTeacher }
    : {};
}

export default async function TeacherRoutinePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const r = dict.routine;
  const db = await createClient();
  const teachers = (await academicData.teachers(db, lang)).map((x) => ({
    id: x.id,
    name: pickLocalized(x, "name", lang),
  }));
  const wanted = (await searchParams).staff;
  const teacher = teachers.find((x) => String(x.id) === wanted) ?? teachers[0];
  return (
    <div className="flex flex-col gap-6">
      <RoutineHeader lang={lang} dict={dict} active="teacher" intro={r.intro} />
      <ChoiceForm
        action={`/${lang}/dashboard/routine/teacher`}
        name="staff"
        label={r.teacher}
        submit={r.show}
        options={teachers}
        value={teacher?.id}
      />
      {teacher ? (
        <TeacherRoutine
          db={db}
          lang={lang}
          dict={dict}
          staffId={teacher.id}
          name={teacher.name}
        />
      ) : null}
    </div>
  );
}
