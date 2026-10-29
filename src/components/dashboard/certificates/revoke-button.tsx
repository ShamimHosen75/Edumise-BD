"use client";

import { revokeCertificate } from "@/app/[lang]/dashboard/certificates/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { TextAreaField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { revokeSchema } from "@/lib/certificates";

/** Revoke with a reason; the certificate then shows as revoked when verified. */
export function RevokeButton({
  lang,
  id,
  reference,
  messages,
}: {
  lang: Locale;
  id: number;
  reference: string;
  messages: Messages;
}) {
  const tr = translator(messages);
  const c = (key: string, vars?: Record<string, string>) =>
    tr(`certificates.${key}`, vars);
  return (
    <FormDialog
      trigger={
        <Button type="button" variant="destructive">
          {c("revoke")}
        </Button>
      }
      title={c("revokeTitle", { reference })}
      description={c("revokeHint")}
      schema={revokeSchema}
      defaultValues={{ reason: "" }}
      onSubmit={(values) => revokeCertificate(lang, id, values)}
      successMessage={c("revokedDone")}
      translate={tr}
      labels={{
        save: c("revokeConfirm"),
        saving: tr("dialog.saving"),
        cancel: tr("dialog.cancel"),
        close: tr("dialog.close"),
      }}
    >
      {(form) => (
        <TextAreaField
          form={form}
          t={tr}
          name="reason"
          label={c("revokeReason")}
        />
      )}
    </FormDialog>
  );
}
