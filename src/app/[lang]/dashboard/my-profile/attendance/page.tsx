import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentAttendancePage } from "@/components/dashboard/attendance/student-attendance-page";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myProfile } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ month?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).attendance.myAttendance }
    : {};
}

/** A student's own attendance. */
export default async function MyAttendancePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["student"]);
  const db = await createClient();
  const profile = await myProfile(db, me.id, lang);
  if (!profile) notFound();
  return (
    <StudentAttendancePage
      db={db}
      lang={lang}
      dict={await getDictionary(lang)}
      studentId={profile.id}
      name={profile.name}
      base={`/${lang}/dashboard/my-profile/attendance`}
      month={(await searchParams).month}
    />
  );
}
