import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SandboxButtons } from "@/components/dashboard/fees/pay-buttons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { feesMessages } from "@/lib/fees-messages";
import { formatCurrency } from "@/lib/format";
import { sandboxProvider } from "@/lib/payments/sandbox";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.online.sandboxTitle }
    : {};
}

/** A pretend gateway page for testing: pay or fail, no real money. */
export default async function SandboxCheckoutPage({ params }: Props) {
  const { lang, id } = await params;
  if (
    !isLocale(lang) ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    !sandboxProvider.available()
  )
    notFound();
  await requireRole(lang, ["guardian"]);
  const dict = await getDictionary(lang);
  const o = dict.fees.online;
  const { data: intent } = await (
    await createClient()
  )
    .from("payment_intents")
    .select("id, amount, provider, status")
    .eq("id", id)
    .maybeSingle();
  if (!intent || intent.provider !== "sandbox") notFound();
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{o.sandboxTitle}</h1>
      <p className="rounded-lg border border-amber-600 p-3 text-sm">
        {o.sandboxNote}
      </p>
      <p className="text-lg">
        {o.amount}:{" "}
        <strong data-testid="sandbox-amount">
          {formatCurrency(intent.amount, lang)}
        </strong>
      </p>
      {intent.status === "created" ? (
        <SandboxButtons
          lang={lang}
          intentId={intent.id}
          messages={feesMessages(dict)}
        />
      ) : (
        <p className="text-sm">{o.closed}</p>
      )}
    </div>
  );
}
