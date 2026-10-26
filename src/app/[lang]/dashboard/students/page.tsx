import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SessionPicker } from "@/components/dashboard/students/session-picker";
import { StudentsHeader } from "@/components/dashboard/students/students-header";
import { StudentsTable } from "@/components/dashboard/students/students-table";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { studentMessages } from "@/lib/student-messages";
import { sessions as sessionList, studentList } from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).students.title }
    : {};
}

export default async function StudentsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const s = dict.students;
  const db = await createClient();
  const all = await sessionList(db, lang);
  const wanted = (await searchParams).session;
  const session =
    all.find((x) => String(x.id) === wanted) ??
    all.find((x) => x.is_current) ??
    all[0];
  const rows = session ? await studentList(db, session.id, lang) : [];

  return (
    <div className="flex flex-col gap-6">
      <StudentsHeader
        lang={lang}
        dict={dict}
        active="list"
        title={s.title}
        intro={s.intro}
      />
      <SessionPicker
        action={`/${lang}/dashboard/students`}
        label={s.session}
        submit={s.show}
        sessions={all}
        value={session?.id}
      />
      <StudentsTable
        lang={lang}
        title={session ? `${s.list} (${session.name})` : s.list}
        rows={rows}
        messages={studentMessages(dict)}
      />
    </div>
  );
}
