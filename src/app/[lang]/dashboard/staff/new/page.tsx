import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StaffForm } from "@/components/dashboard/staff/staff-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { designations } from "@/lib/staff-data";
import { staffMessages } from "@/lib/staff-messages";
import { createClient } from "@/lib/supabase/server";
import { staffFormValues } from "@/lib/validation/staff";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: (await getDictionary(lang)).staff.new } : {};
}

export default async function NewStaffPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{dict.staff.new}</h1>
      <StaffForm
        lang={lang}
        id={null}
        defaults={staffFormValues(null, null)}
        designations={await designations(await createClient())}
        messages={staffMessages(dict)}
      />
      <p className="text-muted-foreground text-sm">{dict.staff.saveFirst}</p>
    </div>
  );
}
