import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalCard } from "@/components/dashboard/students/portal-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myProfile } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).portal.myProfile }
    : {};
}

export default async function MyProfilePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["student"]);
  const dict = await getDictionary(lang);
  const profile = await myProfile(await createClient(), me.id, lang);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{dict.portal.myProfile}</h1>
      {profile ? (
        <PortalCard
          lang={lang}
          dict={dict}
          student={profile}
          attendanceHref={`/${lang}/dashboard/my-profile/attendance`}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {dict.portal.notEnrolled}
        </p>
      )}
    </div>
  );
}
