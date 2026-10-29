import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChoiceForm } from "@/components/routine/choice-form";
import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { StructureGrid } from "@/components/dashboard/fees/structure-grid";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  feeHeads,
  feeSessions,
  structureRows,
  structures,
} from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { localizeDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.structure.title }
    : {};
}

export default async function FeeStructurePage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const s = dict.fees.structure;
  const db = await createClient();
  const sessions = await feeSessions(db);
  const wanted = (await searchParams).session;
  const session =
    sessions.find((x) => String(x.id) === wanted) ??
    sessions.find((x) => x.current) ??
    sessions[0];
  if (!session) notFound();
  // Sessions are newest first: the next one in the list is the previous session.
  const previous = sessions[sessions.indexOf(session) + 1] ?? null;
  const [rows, heads, cells] = await Promise.all([
    structureRows(db, lang),
    feeHeads(db),
    structures(db, session.id),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="structure" />
      <p className="text-muted-foreground text-sm">{s.intro}</p>
      <ChoiceForm
        action={`/${lang}/dashboard/fees/structure`}
        name="session"
        label={s.session}
        submit={s.show}
        options={sessions.map((x) => ({
          id: x.id,
          name: localizeDigits(x.name, lang),
        }))}
        value={session.id}
      />
      <StructureGrid
        key={`${session.id}-${cells.length}-${cells.map((c) => c.amount).join(",")}`}
        lang={lang}
        session={{ id: session.id, name: localizeDigits(session.name, lang) }}
        previous={
          previous
            ? { id: previous.id, name: localizeDigits(previous.name, lang) }
            : null
        }
        rows={rows}
        heads={heads}
        cells={cells}
        messages={feesMessages(dict)}
      />
    </div>
  );
}
