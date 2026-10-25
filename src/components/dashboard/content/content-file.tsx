"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { msg, type Messages } from "@/i18n/messages";
import {
  ATTACHMENT_MAX_BYTES,
  fileTooLarge,
  IMAGE_MAX_BYTES,
} from "@/lib/files";

/** Upload, replace or remove an item's file. The server checks the file again. */
type Result = { ok: boolean; error?: string };

export function ContentFile({
  title,
  kind,
  url,
  messages,
  upload,
  remove,
}: {
  title: string;
  kind: "image" | "document";
  url: string | null;
  messages: Messages;
  /** Server actions, already bound to the item. */
  upload: (data: FormData) => Promise<Result>;
  remove: () => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const m = (key: string) => msg(messages, key)!;
  const image = kind === "image";
  const max = image ? IMAGE_MAX_BYTES : ATTACHMENT_MAX_BYTES;
  const isImageUrl = url !== null && /\.(png|jpe?g|webp)$/i.test(url);

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    form?: HTMLFormElement,
  ) =>
    start(async () => {
      setStatus(null);
      const result = await action().catch(() => ({
        ok: false,
        error: "errors.uploadFailed",
      }));
      setStatus(
        result.ok
          ? { ok: true, text: m("contentAdmin.done") }
          : { ok: false, text: m(result.error ?? "auth.unexpected") },
      );
      if (result.ok) {
        form?.reset();
        router.refresh();
      }
    });

  return (
    <section
      aria-labelledby="file-title"
      aria-busy={pending}
      className="flex max-w-4xl flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="file-title" className="font-semibold">
        {title}
      </h2>
      {url ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {isImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded file
            <img
              src={url}
              alt=""
              className="aspect-video w-48 rounded-lg border object-cover"
            />
          ) : (
            <FileText className="size-5" aria-hidden="true" />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {m("contentAdmin.currentFile")}
          </a>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(remove)}
          >
            {m("contentAdmin.removeFile")}
          </Button>
        </div>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          // A body over the server limit fails before the server can answer.
          if (fileTooLarge(data.get("file"), max)) {
            setStatus({ ok: false, text: m("errors.fileSize") });
            return;
          }
          run(() => upload(data), form);
        }}
      >
        <FormField id="content-file" label={m("contentAdmin.file")}>
          {(aria) => (
            <Input
              {...aria}
              name="file"
              type="file"
              required
              accept={
                image
                  ? "image/png,image/jpeg,image/webp"
                  : "application/pdf,image/png,image/jpeg,image/webp"
              }
            />
          )}
        </FormField>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? m("contentAdmin.uploading") : m("contentAdmin.upload")}
        </Button>
      </form>
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
