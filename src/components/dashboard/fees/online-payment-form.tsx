"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOnlinePayment } from "@/app/[lang]/dashboard/fees/settings/online-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { ProviderName } from "@/lib/payments/types";

/** Online payment on or off, and the gateway (admins only). */
export function OnlinePaymentForm({
  lang,
  initial,
  providers,
  messages,
}: {
  lang: Locale;
  initial: { enabled: boolean; provider: ProviderName };
  /** Every provider and whether it is set up. */
  providers: { name: ProviderName; available: boolean }[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState(initial.provider);
  const [error, setError] = useState("");
  return (
    <form
      className="flex max-w-xl flex-col gap-4 rounded-xl border p-4"
      aria-busy={pending}
      aria-labelledby="online-title"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveOnlinePayment(lang, {
            online_payment_enabled: enabled,
            payment_provider: provider,
          }).catch(() => ({
            ok: false as const,
            error: "auth.unexpected" as const,
            fieldErrors: undefined,
          }));
          if (!r.ok) {
            setError(tr(r.fieldErrors?.payment_provider ?? r.error));
            return;
          }
          setError("");
          toast.success(tr("fees.settings.saved"));
          router.refresh();
        });
      }}
    >
      <div>
        <h3 id="online-title" className="font-semibold">
          {tr("fees.online.settingsTitle")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {tr("fees.online.settingsIntro")}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {tr("fees.online.enabled")}
      </label>
      <FormField
        id="online-provider"
        label={tr("fees.online.provider")}
        error={error || undefined}
      >
        {(aria) => (
          <select
            {...aria}
            className="bg-background h-10 rounded-md border px-3 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderName)}
          >
            {providers.map((p) => (
              <option key={p.name} value={p.name} disabled={!p.available}>
                {tr(`fees.online.providers.${p.name}`)}
                {p.available ? "" : ` (${tr("fees.online.notSetUp")})`}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <Button type="submit" className="w-fit" disabled={pending}>
        {tr("fees.settings.save")}
      </Button>
    </form>
  );
}
