import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignationsManager } from "@/components/dashboard/staff/designations-manager";
import { StaffHeader } from "@/components/dashboard/staff/staff-header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { designations } from "@/lib/staff-data";
import { staffMessages } from "@/lib/staff-messages";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).staff.designations }
    : {};
}

export default async function DesignationsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const rows = await designations(await createClient());
  return (
    <div className="flex flex-col gap-6">
      <StaffHeader
        lang={lang}
        dict={dict}
        active="designations"
        title={dict.staff.designations}
        intro={dict.staff.designationsIntro}
      />
      <DesignationsManager
        lang={lang}
        rows={rows}
        messages={staffMessages(dict)}
      />
    </div>
  );
}
