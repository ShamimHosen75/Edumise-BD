"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";

import {
  checkAdmissionStatus,
  type StatusResult,
} from "@/app/[lang]/(site)/admission/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { TextField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { formatDateTime, pickLocalized } from "@/lib/format";
import { statusLookupSchema } from "@/lib/validation/admission";

/** Look up an application by tracking number and mobile number. */
export function StatusForm({
  lang,
  messages,
}: {
  lang: Locale;
  messages: Messages;
}) {
  const tr = translator(messages);
  const [result, setResult] = useState<StatusResult | null>(null);
  const form = useForm<FieldValues>({
    resolver: zodResolver(
      statusLookupSchema,
    ) as unknown as Resolver<FieldValues>,
    defaultValues: { tracking_no: "", phone: "" },
  });
  const submit = form.handleSubmit(async (values) => {
    setResult(
      await checkAdmissionStatus(lang, values).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      })),
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={submit}
        noValidate
        aria-busy={form.formState.isSubmitting}
        className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <TextField
          form={form}
          t={tr}
          name="tracking_no"
          label={tr("admission.fields.trackingNo")}
        />
        <TextField
          form={form}
          t={tr}
          name="phone"
          label={tr("admission.fields.phoneLookup")}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {tr("admission.lookup")}
        </Button>
      </form>
      <div role="status" aria-live="polite">
        {result && !result.ok ? (
          <p className="text-destructive">{tr(result.error)}</p>
        ) : null}
        {result?.ok ? (
          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-semibold">
              {tr("admission.statusOf", { tracking: result.trackingNo })}
            </h2>
            <p className="text-2xl font-bold" data-testid="admission-status">
              {tr(`admission.statuses.${result.status}`)}
            </p>
            <p className="text-sm">
              {pickLocalized(
                { name_en: result.class_en, name_bn: result.class_bn },
                "name",
                lang,
              )}
            </p>
            {result.testAt ? (
              <p className="text-sm">
                {tr("admission.testAt")}: {formatDateTime(result.testAt, lang)}
                {result.testVenue
                  ? ` · ${tr("admission.venue")}: ${result.testVenue}`
                  : ""}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
