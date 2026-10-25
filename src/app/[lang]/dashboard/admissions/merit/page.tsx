import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdmissionsHeader } from "@/components/dashboard/admissions/admissions-header";
import { MeritTable } from "@/components/dashboard/admissions/merit-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { admissionMessages } from "@/lib/admission-messages";
import { admissionQueue, classOptions } from "@/lib/admissions-data";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ class?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).admissionsAdmin.merit }
    : {};
}

export default async function MeritPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const a = dict.admissionsAdmin;
  const db = await createClient();
  const classes = await classOptions(db, lang);
  const wanted = (await searchParams).class;
  const chosen = classes.find((c) => String(c.id) === wanted) ?? classes[0];
  const rows = chosen
    ? (await admissionQueue(db, lang, {})).filter(
        (r) => r.class_name === chosen.name,
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <AdmissionsHeader lang={lang} dict={dict} active="merit" />
      <form
        action={`/${lang}/dashboard/admissions/merit`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="merit-class">{a.class}</Label>
          <select
            id="merit-class"
            name="class"
            defaultValue={chosen?.id}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {a.filter}
        </Button>
      </form>
      {chosen ? (
        <MeritTable
          lang={lang}
          className={chosen.name}
          rows={rows}
          messages={admissionMessages(dict)}
        />
      ) : null}
    </div>
  );
}
