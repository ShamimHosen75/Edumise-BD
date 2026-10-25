"use client";

import Link from "next/link";
import { useState } from "react";
import type { FieldValues } from "react-hook-form";

import { uploadApplicationDocument } from "@/app/[lang]/(site)/admission/actions";
import type { Translate } from "@/components/dashboard/academic/labels";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";

import { ApplicationSummary } from "./application-summary";
import { FileInput } from "./file-input";
import type { ClassOption, Option } from "./step-fields";

export type Submitted = {
  trackingNo: string;
  submittedAt: string;
  uploadToken: string;
  values: FieldValues;
  failed: ("birth_certificate" | "transcript")[];
  photoUrl: string;
};

/** Tracking number, the printable application copy, and retries for failed uploads. */
export function ApplySuccess({
  lang,
  tr,
  submitted,
  classes,
  groups,
  files,
}: {
  lang: Locale;
  tr: Translate;
  submitted: Submitted;
  classes: ClassOption[];
  groups: Option[];
  files: Record<string, string | undefined>;
}) {
  const [failed, setFailed] = useState(submitted.failed);
  const label = (kind: string) =>
    tr(
      `admission.fields.${kind === "birth_certificate" ? "birthCertificate" : "transcript"}`,
    );

  return (
    <div className="flex flex-col gap-6">
      <div
        role="status"
        className="bg-primary/10 flex flex-col gap-2 rounded-xl p-4 print:hidden"
      >
        <h2 className="text-lg font-semibold">
          {tr("admission.successTitle")}
        </h2>
        <p className="text-sm">{tr("admission.successIntro")}</p>
        <p
          className="text-2xl font-bold tracking-wide"
          data-testid="tracking-no"
        >
          {submitted.trackingNo}
        </p>
      </div>

      {failed.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4 print:hidden">
          <p className="text-destructive text-sm">
            {tr("admission.documentMissing")}
          </p>
          {failed.map((kind) => (
            <FileInput
              key={kind}
              id={`retry-${kind}`}
              label={label(kind)}
              hint={tr("admission.fields.documentHint")}
              accept="application/pdf,image/jpeg"
              onFile={async (file) => {
                const fd = new FormData();
                fd.set("file", file);
                const result = await uploadApplicationDocument(
                  lang,
                  submitted.uploadToken,
                  kind,
                  fd,
                ).catch(() => ({ ok: false }));
                if (result.ok) setFailed((f) => f.filter((k) => k !== kind));
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 print:hidden">
        <Button type="button" onClick={() => window.print()}>
          {tr("admission.printCopy")}
        </Button>
        <Link
          href={`/${lang}/admission/status`}
          className={buttonVariants({ variant: "outline" })}
        >
          {tr("admission.checkStatus")}
        </Link>
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.location.reload()}
        >
          {tr("admission.applyAnother")}
        </Button>
      </div>

      <section aria-labelledby="copy-title" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="copy-title" className="text-xl font-semibold">
              {tr("admission.copyTitle")}
            </h2>
            <p className="text-sm">
              {tr("admission.fields.trackingNo")}:{" "}
              <strong>{submitted.trackingNo}</strong>
            </p>
            <p className="text-muted-foreground text-sm">
              {tr("admission.submittedOn", {
                date: formatDateTime(submitted.submittedAt, lang),
              })}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- the applicant's own photo, from this device */}
          <img
            src={submitted.photoUrl}
            alt=""
            className="size-28 rounded-lg border object-cover"
          />
        </div>
        <ApplicationSummary
          values={submitted.values}
          tr={tr}
          lang={lang}
          classes={classes}
          groups={groups}
          files={files}
        />
        <p className="text-sm">✓ {tr("admission.fields.declaration")}</p>
      </section>
    </div>
  );
}
