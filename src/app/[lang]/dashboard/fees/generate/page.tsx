import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { GenerateForm } from "@/components/dashboard/fees/generate-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { feeHeads, feeSessions, fineRule } from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.generate.title }
    : {};
}

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

export default async function GenerateInvoicesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const db = await createClient();
  const [sessions, heads, rule, { data: exams }, { data: classes }] =
    await Promise.all([
      feeSessions(db),
      feeHeads(db),
      fineRule(db),
      db
        .from("exams")
        .select("id, session_id, name_en, name_bn")
        .order("starts_on"),
      db.from("classes").select("id, name_en, name_bn").order("level"),
    ]);
  const current = sessions.find((s) => s.current) ?? sessions[0];
  if (!current) notFound();
  const today = dhakaToday();
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="generate" />
      <p className="text-muted-foreground text-sm">
        {dict.fees.generate.intro}
      </p>
      <GenerateForm
        lang={lang}
        sessions={sessions.map((s) => ({
          id: s.id,
          name: localizeDigits(s.name, lang),
        }))}
        heads={heads
          .filter((h) => h.frequency === "one_time")
          .map((h) => ({ id: h.id, name: pickLocalized(h, "name", lang) }))}
        exams={(exams ?? []).map((e) => ({
          id: e.id,
          sessionId: e.session_id,
          name: pickLocalized(e, "name", lang),
        }))}
        classes={(classes ?? []).map((c) => ({
          id: c.id,
          name: pickLocalized(c, "name", lang),
        }))}
        defaults={{
          sessionId: current.id,
          month: today.slice(0, 7),
          dueOn: addDays(today, rule.dueDays),
        }}
        messages={feesMessages(dict)}
      />
    </div>
  );
}
