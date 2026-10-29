import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentResultsPage } from "@/components/results/student-results-page";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myProfile } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ exam?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).results.title }
    : {};
}

/** A student's own published results. */
export default async function MyResultsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["student"]);
  const db = await createClient();
  const profile = await myProfile(db, me.id, lang);
  if (!profile) notFound();
  return (
    <StudentResultsPage
      db={db}
      lang={lang}
      dict={await getDictionary(lang)}
      studentId={profile.id}
      name={profile.name}
      code={profile.code}
      base={`/${lang}/dashboard/my-profile/results`}
      exam={(await searchParams).exam}
    />
  );
}
