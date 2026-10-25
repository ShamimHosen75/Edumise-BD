import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdmissionsHeader } from "@/components/dashboard/admissions/admissions-header";
import { AdmissionsTable } from "@/components/dashboard/admissions/admissions-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { admissionMessages } from "@/lib/admission-messages";
import { admissionQueue } from "@/lib/admissions-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

const date = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).admissionsAdmin.title }
    : {};
}

export default async function AdmissionsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const a = dict.admissionsAdmin;
  const sp = await searchParams;
  const range = { from: date(sp.from), to: date(sp.to) };
  const rows = await admissionQueue(await createClient(), lang, range);

  return (
    <div className="flex flex-col gap-6">
      <AdmissionsHeader lang={lang} dict={dict} active="queue" />
      <form
        action={`/${lang}/dashboard/admissions`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">{a.from}</Label>
          <Input id="from" name="from" type="date" defaultValue={range.from} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">{a.to}</Label>
          <Input id="to" name="to" type="date" defaultValue={range.to} />
        </div>
        <Button type="submit" variant="outline">
          {a.filter}
        </Button>
      </form>
      <AdmissionsTable
        lang={lang}
        rows={rows}
        messages={admissionMessages(dict)}
      />
    </div>
  );
}
