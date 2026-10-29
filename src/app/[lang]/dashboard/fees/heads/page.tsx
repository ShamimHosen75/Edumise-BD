import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeeHeadsManager } from "@/components/dashboard/fees/fee-heads-manager";
import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { feeHeads } from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.heads.title }
    : {};
}

export default async function FeeHeadsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="heads" />
      <FeeHeadsManager
        lang={lang}
        rows={await feeHeads(await createClient())}
        messages={feesMessages(dict)}
      />
    </div>
  );
}
