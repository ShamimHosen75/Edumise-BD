"use client";

import { cancelPayment } from "@/app/[lang]/dashboard/fees/collect/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { TextAreaField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { cancelReasonSchema } from "@/lib/validation/collection";

/** Cancel a payment with a reason (admins). The receipt stays, marked cancelled. */
export function CancelPaymentButton({
  lang,
  id,
  receiptNo,
  messages,
}: {
  lang: Locale;
  id: number;
  receiptNo: string;
  messages: Messages;
}) {
  const tr = translator(messages);
  const r = (key: string, vars?: Record<string, string>) =>
    tr(`fees.receipt.${key}`, vars);
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="destructive" className="w-fit">
          {r("cancel")}
        </Button>
      }
      title={r("cancelTitle", { no: receiptNo })}
      description={r("cancelHint")}
      schema={cancelReasonSchema}
      defaultValues={{ reason: "" }}
      onSubmit={(values) => cancelPayment(lang, { ...values, id })}
      successMessage={r("cancelledDone")}
      translate={tr}
      labels={{
        save: r("cancelConfirm"),
        saving: tr("dialog.saving"),
        cancel: tr("dialog.cancel"),
        close: tr("dialog.close"),
      }}
    >
      {(form) => (
        <TextAreaField form={form} t={tr} name="reason" label={r("reason")} />
      )}
    </FormDialog>
  );
}
