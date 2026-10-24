"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addAttachment,
  removeAttachment,
  setPageCover,
} from "@/app/[lang]/dashboard/pages/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";

export type AttachmentItem = {
  id: number;
  label: string;
  url: string;
  size: string;
};

type Props = {
  lang: Locale;
  pageId: number;
  coverUrl: string | null;
  attachments: AttachmentItem[];
  messages: Messages;
};

/** Cover image and attachments for a saved page. Files are checked again on the server. */
export function PageMedia({
  lang,
  pageId,
  coverUrl,
  attachments,
  messages,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const m = (key: string) => msg(messages, key)!;

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    form?: HTMLFormElement,
  ) =>
    start(async () => {
      setStatus(null);
      const result = await action();
      setStatus(
        result.ok
          ? { ok: true, text: m("cms.done") }
          : { ok: false, text: m(result.error ?? "auth.unexpected") },
      );
      if (result.ok) {
        form?.reset();
        router.refresh();
      }
    });

  return (
    <section
      aria-label={m("cms.attachments")}
      className="flex max-w-4xl flex-col gap-6 rounded-xl border p-4"
      aria-busy={pending}
    >
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{m("cms.cover")}</h2>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded file
          <img
            src={coverUrl}
            alt=""
            className="aspect-[3/1] w-full max-w-md rounded-lg object-cover"
          />
        ) : null}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(() => setPageCover(lang, pageId, new FormData(form)), form);
          }}
        >
          <FormField
            id="cover-file"
            label={m("cms.cover")}
            hint={m("cms.coverHint")}
          >
            {(aria) => (
              <Input
                {...aria}
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
              />
            )}
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            {m("cms.uploadCover")}
          </Button>
          {coverUrl ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                const data = new FormData();
                data.set("remove", "1");
                run(() => setPageCover(lang, pageId, data));
              }}
            >
              {m("cms.removeCover")}
            </Button>
          ) : null}
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">{m("cms.attachments")}</h2>
        {attachments.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {a.label}
                </a>
                <span className="text-muted-foreground text-xs">{a.size}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => removeAttachment(lang, a.id))}
                >
                  {m("cms.remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(() => addAttachment(lang, pageId, new FormData(form)), form);
          }}
        >
          <FormField id="att-label" label={m("cms.attachmentLabel")}>
            {(aria) => (
              <Input {...aria} name="label" required maxLength={120} />
            )}
          </FormField>
          <FormField id="att-label-bn" label={m("cms.attachmentLabelBn")}>
            {(aria) => (
              <Input {...aria} name="label_bn" lang="bn" maxLength={120} />
            )}
          </FormField>
          <FormField
            id="att-file"
            label={m("cms.attachmentFile")}
            hint={m("cms.attachmentHint")}
          >
            {(aria) => (
              <Input
                {...aria}
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                required
              />
            )}
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? m("cms.uploading") : m("cms.addAttachment")}
            </Button>
          </div>
        </form>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={
          status?.ok === false ? "text-destructive text-sm" : "text-sm"
        }
      >
        {status?.text}
      </p>
    </section>
  );
}
