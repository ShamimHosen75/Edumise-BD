import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeesNav } from "@/components/dashboard/fees/fees-nav";
import { FineSettingsForm } from "@/components/dashboard/fees/fine-settings-form";
import { OnlinePaymentForm } from "@/components/dashboard/fees/online-payment-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { toTakaText } from "@/lib/fees";
import { requireRole } from "@/lib/auth/session";
import { fineRule, onlinePayment } from "@/lib/fees-data";
import { feesMessages } from "@/lib/fees-messages";
import { getProvider, isProvider, PROVIDERS } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).fees.settings.title }
    : {};
}

export default async function FineSettingsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const me = await requireRole(lang, ["super_admin", "admin", "accountant"]);
  const db = await createClient();
  const [rule, online] = await Promise.all([fineRule(db), onlinePayment(db)]);
  return (
    <div className="flex flex-col gap-5">
      <FeesNav lang={lang} dict={dict} active="settings" />
      <div>
        <h2 className="text-lg font-semibold">{dict.fees.settings.title}</h2>
        <p className="text-muted-foreground text-sm">
          {dict.fees.settings.intro}
        </p>
      </div>
      <FineSettingsForm
        lang={lang}
        initial={{
          late_fine_per_day: toTakaText(rule.perDay),
          late_fine_cap: toTakaText(rule.cap),
          grace_days: String(rule.graceDays),
          due_days: String(rule.dueDays),
        }}
        messages={feesMessages(dict)}
      />
      {me.role === "admin" || me.role === "super_admin" ? (
        <OnlinePaymentForm
          lang={lang}
          initial={{
            enabled: online.enabled,
            provider: isProvider(online.provider) ? online.provider : "manual",
          }}
          providers={PROVIDERS.map((name) => ({
            name,
            available: getProvider(name)!.available(),
          }))}
          messages={feesMessages(dict)}
        />
      ) : null}
    </div>
  );
}
