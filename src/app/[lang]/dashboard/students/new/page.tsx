import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentForm } from "@/components/dashboard/students/student-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { studentMessages } from "@/lib/student-messages";
import { groupOptions, sectionOptions } from "@/lib/students-data";
import { createClient } from "@/lib/supabase/server";
import { studentFormValues } from "@/lib/validation/student";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).studentProfile.new }
    : {};
}

export default async function NewStudentPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const db = await createClient();
  const [sections, groups] = await Promise.all([
    sectionOptions(db, lang),
    groupOptions(db, lang),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{dict.studentProfile.new}</h1>
        <p className="text-muted-foreground text-sm">
          {dict.studentProfile.saveFirst}
        </p>
      </div>
      <StudentForm
        lang={lang}
        id={null}
        defaults={studentFormValues(null)}
        sections={sections}
        groups={groups}
        messages={studentMessages(dict)}
      />
    </div>
  );
}
