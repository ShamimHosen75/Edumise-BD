import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalFees } from "@/components/dashboard/fees/portal-fees";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { myProfile } from "@/lib/portal-data";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.portal.title }
    : {};
}

/** A student's own bills and receipts. */
export default async function MyFeesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["student"]);
  const db = await createClient();
  const profile = await myProfile(db, me.id, lang);
  if (!profile) notFound();
  return (
    <PortalFees
      db={db}
      lang={lang}
      dict={await getDictionary(lang)}
      studentId={profile.id}
      name={profile.name}
      code={profile.code}
    />
  );
}
