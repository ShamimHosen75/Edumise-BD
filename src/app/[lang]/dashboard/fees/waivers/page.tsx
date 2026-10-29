import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { WaiversManager } from "@/components/dashboard/fees/waivers-manager";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { feeHeads, waivers } from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.waivers.title }
    : {};
}

/** Waivers of the current session. */
export default async function WaiversPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const me = await requireRole(lang, ["super_admin", "admin", "accountant"]);
  const dict = await getDictionary(lang);
  const db = await createClient();
  const { data: session } = await db
    .from("academic_sessions")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  const [rows, heads] = await Promise.all([
    session ? waivers(db, session.id, lang) : [],
    feeHeads(db),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="waivers" />
      <p className="text-muted-foreground text-sm">{dict.fees.waivers.intro}</p>
      <WaiversManager
        lang={lang}
        rows={rows}
        heads={heads.map((h) => ({
          id: h.id,
          name: pickLocalized(h, "name", lang),
        }))}
        canApprove={me.role === "admin" || me.role === "super_admin"}
        messages={feesMessages(dict)}
      />
    </div>
  );
}
