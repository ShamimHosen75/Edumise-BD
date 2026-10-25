import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StaffHeader } from "@/components/dashboard/staff/staff-header";
import { StaffTable } from "@/components/dashboard/staff/staff-table";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { staffList } from "@/lib/staff-data";
import { staffMessages } from "@/lib/staff-messages";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).staff.title }
    : {};
}

export default async function StaffPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const rows = await staffList(await createClient());
  return (
    <div className="flex flex-col gap-6">
      <StaffHeader
        lang={lang}
        dict={dict}
        active="list"
        title={dict.staff.title}
        intro={dict.staff.intro}
      />
      <StaffTable lang={lang} rows={rows} messages={staffMessages(dict)} />
    </div>
  );
}
