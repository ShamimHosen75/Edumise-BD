import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImportTool } from "@/components/dashboard/students/import-tool";
import { SessionPicker } from "@/components/dashboard/students/session-picker";
import { StudentsHeader } from "@/components/dashboard/students/students-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { studentMessages } from "@/lib/student-messages";
import { sessions as sessionList } from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).importStudents.title }
    : {};
}

export default async function ImportPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const m = dict.importStudents;
  const all = await sessionList(await createClient(), lang);
  const wanted = (await searchParams).session;
  const session =
    all.find((s) => String(s.id) === wanted) ??
    all.find((s) => s.is_current) ??
    all[0];

  return (
    <div className="flex flex-col gap-6">
      <StudentsHeader
        lang={lang}
        dict={dict}
        active="import"
        title={m.title}
        intro={m.intro}
      />
      <SessionPicker
        action={`/${lang}/dashboard/students/import`}
        label={m.session}
        submit={dict.students.show}
        sessions={all}
        value={session?.id}
      />
      {session ? (
        <ImportTool
          key={session.id}
          lang={lang}
          sessionId={session.id}
          messages={studentMessages(dict)}
        />
      ) : null}
    </div>
  );
}
