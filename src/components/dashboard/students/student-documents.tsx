"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import {
  removeStudentDocument,
  uploadStudentDocument,
} from "@/app/[lang]/dashboard/students/document-actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { fileTooLarge, IMAGE_MAX_BYTES } from "@/lib/files";
import { formatBytes, formatDate } from "@/lib/format";

type Doc = {
  id: number;
  label: string;
  file_size: number;
  created_at: string;
  url: string | null;
};
type AdmissionDoc = {
  kind: string;
  file_size: number;
  tracking: string;
  url: string | null;
};

/** Private documents kept for the student, and those from the admission application. */
export function StudentDocuments({
  lang,
  studentId,
  documents,
  admissionDocuments,
  messages,
}: {
  lang: Locale;
  studentId: number;
  documents: Doc[];
  admissionDocuments: AdmissionDoc[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const p = (key: string, vars?: Record<string, string>) =>
    tr(`studentProfile.${key}`, vars);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  const upload = (data: FormData) => {
    if (fileTooLarge(data.get("file"), IMAGE_MAX_BYTES))
      return void toast.error(tr("errors.fileSize"));
    start(async () => {
      const result = await uploadStudentDocument(lang, studentId, data).catch(
        () => ({ ok: false as const, error: "errors.uploadFailed" as const }),
      );
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(p("done"));
      formRef.current?.reset();
      router.refresh();
    });
  };

  const link = (url: string | null) =>
    url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {p("view")}
      </a>
    ) : null;

  return (
    <div className="flex max-w-4xl flex-col gap-6" aria-busy={pending}>
      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{p("documentList")}</h2>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{p("noDocumentsYet")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <FileText className="size-4" aria-hidden="true" />
                <span className="font-medium">{d.label}</span>
                <span className="text-muted-foreground text-xs">
                  {formatBytes(d.file_size, lang)} ·{" "}
                  {formatDate(d.created_at, lang)}
                </span>
                {link(d.url)}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  aria-label={`${p("remove")}: ${d.label}`}
                  onClick={() =>
                    start(async () => {
                      const result = await removeStudentDocument(
                        lang,
                        studentId,
                        d.id,
                      ).catch(() => ({
                        ok: false as const,
                        error: "auth.unexpected" as const,
                      }));
                      if (!result.ok) return void toast.error(tr(result.error));
                      router.refresh();
                    })
                  }
                >
                  {p("remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          ref={formRef}
          action={upload}
          className="flex flex-wrap items-end gap-3 border-t pt-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-label">{p("documentLabel")}</Label>
            <Input id="document-label" name="label" required maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-file">{p("documentFile")}</Label>
            <Input
              id="document-file"
              name="file"
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {p("uploadDocument")}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{p("admissionDocuments")}</h2>
        {admissionDocuments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{p("noDocumentsYet")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {admissionDocuments.map((d) => (
              <li
                key={`${d.tracking}-${d.kind}`}
                className="flex flex-wrap items-center gap-2"
              >
                <FileText className="size-4" aria-hidden="true" />
                <span>
                  {d.kind === "birth_certificate"
                    ? tr("admission.fields.birthCertificate")
                    : tr("admission.fields.transcript")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {d.tracking} · {formatBytes(d.file_size, lang)}
                </span>
                {link(d.url)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
