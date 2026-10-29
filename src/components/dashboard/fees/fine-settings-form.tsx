"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveFineSettings } from "@/app/[lang]/dashboard/fees/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

type Values = {
  late_fine_per_day: string;
  late_fine_cap: string;
  grace_days: string;
  due_days: string;
};
const FIELDS = [
  ["late_fine_per_day", "perDay", "decimal"],
  ["late_fine_cap", "cap", "decimal"],
  ["grace_days", "graceDays", "numeric"],
  ["due_days", "dueDays", "numeric"],
] as const;

/** Late fine per day, its cap, grace days and the default days to pay. */
export function FineSettingsForm({
  lang,
  initial,
  messages,
}: {
  lang: Locale;
  initial: Values;
  messages: Messages;
}) {
  const tr = translator(messages);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="flex max-w-xl flex-col gap-4 rounded-xl border p-4"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveFineSettings(lang, values).catch(() => ({
            ok: false as const,
            error: "auth.unexpected" as const,
            fieldErrors: undefined,
          }));
          if (!r.ok) {
            const fields = Object.entries(r.fieldErrors ?? {});
            setErrors(Object.fromEntries(fields.map(([k, v]) => [k, tr(v)])));
            // Field problems are shown under the fields; a toast would cover the
            // button on a phone.
            if (!fields.length) toast.error(tr(r.error));
            return;
          }
          setErrors({});
          toast.success(tr("fees.settings.saved"));
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([name, label, mode]) => (
          <FormField
            key={name}
            id={`fine-${name}`}
            label={tr(`fees.settings.${label}`)}
            error={errors[name]}
          >
            {(aria) => (
              <Input
                {...aria}
                inputMode={mode}
                value={values[name]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [name]: e.target.value }))
                }
              />
            )}
          </FormField>
        ))}
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {tr("fees.settings.save")}
      </Button>
    </form>
  );
}
