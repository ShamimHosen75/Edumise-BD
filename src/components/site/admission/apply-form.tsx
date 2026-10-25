"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";

import {
  submitApplication,
  uploadApplicationDocument,
} from "@/app/[lang]/(site)/admission/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import { classUsesGroups } from "@/lib/validation/academic";
import {
  applicationSchema,
  DOCUMENT_MAX_BYTES,
  PHOTO_MAX_BYTES,
} from "@/lib/validation/admission";

import { ApplicationSummary } from "./application-summary";
import { ApplySuccess, type Submitted } from "./apply-success";
import { FileInput } from "./file-input";
import { squarePhoto } from "./square-photo";
import {
  AcademicFields,
  GuardianFields,
  StudentFields,
  type ClassOption,
  type Option,
} from "./step-fields";

const DRAFT_KEY = "edumise-admission-draft";
const STEPS = [
  "student",
  "guardian",
  "academic",
  "documents",
  "review",
] as const;
const STEP_FIELDS: Record<(typeof STEPS)[number], string[]> = {
  student: [
    "student_name_en",
    "student_name_bn",
    "birth_date",
    "gender",
    "birth_reg_no",
    "religion",
    "blood_group",
  ],
  guardian: [
    "father_name",
    "mother_name",
    "local_guardian_name",
    "guardian_phone",
    "guardian_occupation",
    "guardian_email",
    "present_address",
    "permanent_address",
  ],
  academic: ["class_id", "group_id", "previous_school", "last_result"],
  documents: [],
  review: ["declaration"],
};
const EMPTY: FieldValues = {
  student_name_en: "",
  student_name_bn: "",
  birth_date: "",
  gender: "",
  birth_reg_no: "",
  religion: "",
  blood_group: "",
  father_name: "",
  mother_name: "",
  local_guardian_name: "",
  guardian_phone: "",
  guardian_occupation: "",
  guardian_email: "",
  present_address: "",
  permanent_address: "",
  class_id: null,
  group_id: null,
  previous_school: "",
  last_result: "",
  declaration: false,
  website: "",
};
type Files = { photo?: File; birth_certificate?: File; transcript?: File };

/** The five-step public admission form. Answers (not files) are kept in localStorage. */
export function ApplyForm({
  lang,
  classes,
  groups,
  messages,
}: {
  lang: Locale;
  classes: ClassOption[];
  groups: Option[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Files>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "submitting" | "uploading">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Submitted | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm<FieldValues>({
    resolver: zodResolver(
      applicationSchema,
    ) as unknown as Resolver<FieldValues>,
    defaultValues: EMPTY,
  });

  // Restore a saved draft once, then keep saving answers as they change.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved)
        form.reset({ ...EMPTY, ...JSON.parse(saved), declaration: false });
    } catch {
      /* no storage: start empty */
    }
    const sub = form.watch((values) => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ...values, website: "" }),
        );
      } catch {
        /* storage full or blocked: the form still works */
      }
    });
    return () => sub.unsubscribe();
  }, [form]);

  const go = (next: number) => {
    setStep(next);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  };

  const checkFiles = () => {
    const errors: Record<string, string> = {};
    if (!files.photo) errors.photo = tr("errors.required");
    if (!files.birth_certificate)
      errors.birth_certificate = tr("errors.required");
    setFileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const next = async () => {
    const name = STEPS[step]!;
    const ok =
      name === "documents"
        ? checkFiles()
        : await form.trigger(STEP_FIELDS[name]);
    if (name === "academic" && ok) {
      const cls = classes.find((c) => c.id === form.getValues("class_id"));
      if (cls && classUsesGroups(cls.level) && !form.getValues("group_id")) {
        form.setError("group_id", { message: "errors.groupRequired" });
        return;
      }
      if (cls && !classUsesGroups(cls.level)) form.setValue("group_id", null);
    }
    if (ok) go(step + 1);
  };

  const submit = form.handleSubmit(async (values) => {
    if (!checkFiles()) return go(3);
    setBusy("submitting");
    setError("");
    const data = new FormData();
    data.set("data", JSON.stringify(values));
    data.set("photo", files.photo!);
    const result = await submitApplication(lang, data).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
      fieldErrors: undefined,
    }));
    if (!result.ok) {
      setBusy("");
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      setError(tr(result.error));
      return;
    }
    setBusy("uploading");
    const failed: ("birth_certificate" | "transcript")[] = [];
    for (const kind of ["birth_certificate", "transcript"] as const) {
      const file = files[kind];
      if (!file || !result.uploadToken) continue;
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadApplicationDocument(
        lang,
        result.uploadToken,
        kind,
        fd,
      ).catch(() => ({ ok: false }));
      if (!up.ok) failed.push(kind);
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setBusy("");
    setDone({
      ...result,
      values,
      failed,
      photoUrl: URL.createObjectURL(files.photo!),
    });
  });

  if (done)
    return (
      <ApplySuccess
        lang={lang}
        tr={tr}
        submitted={done}
        classes={classes}
        groups={groups}
        files={{
          photo: files.photo?.name,
          birth_certificate: files.birth_certificate?.name,
          transcript: files.transcript?.name,
        }}
      />
    );

  const name = STEPS[step]!;
  const pct = ((step + 1) / STEPS.length) * 100;
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={busy !== ""}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {tr("admission.progress", {
            n: localizeDigits(step + 1, lang),
            total: localizeDigits(STEPS.length, lang),
            name: tr(`admission.steps.${name}`),
          })}
        </h2>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={tr(`admission.steps.${name}`)}
          className="bg-muted h-2 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {name === "student" ? (
        <>
          <StudentFields form={form} tr={tr} />
          <FileInput
            id="photo"
            label={tr("admission.fields.photo")}
            hint={tr("admission.fields.photoHint")}
            accept="image/jpeg,image/png"
            error={fileErrors.photo}
            fileName={files.photo?.name}
            onFile={async (file) => {
              try {
                const photo = await squarePhoto(file, PHOTO_MAX_BYTES);
                setFiles((f) => ({ ...f, photo }));
                setFileErrors((e) => ({ ...e, photo: "" }));
              } catch {
                setFileErrors((e) => ({ ...e, photo: tr("errors.photoType") }));
              }
            }}
          />
        </>
      ) : null}
      {name === "guardian" ? <GuardianFields form={form} tr={tr} /> : null}
      {name === "academic" ? (
        <AcademicFields form={form} tr={tr} classes={classes} groups={groups} />
      ) : null}
      {name === "documents" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["birth_certificate", "transcript"] as const).map((kind) => (
            <FileInput
              key={kind}
              id={kind}
              label={tr(
                `admission.fields.${kind === "birth_certificate" ? "birthCertificate" : "transcript"}`,
              )}
              hint={tr("admission.fields.documentHint")}
              accept="application/pdf,image/jpeg"
              error={fileErrors[kind]}
              fileName={files[kind]?.name}
              onFile={(file) => {
                if (file.size > DOCUMENT_MAX_BYTES)
                  return setFileErrors((e) => ({
                    ...e,
                    [kind]: tr("errors.fileSize"),
                  }));
                setFiles((f) => ({ ...f, [kind]: file }));
                setFileErrors((e) => ({ ...e, [kind]: "" }));
              }}
            />
          ))}
        </div>
      ) : null}
      {name === "review" ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {tr("admission.reviewIntro")}
          </p>
          <ApplicationSummary
            values={form.getValues()}
            tr={tr}
            lang={lang}
            classes={classes}
            groups={groups}
            files={{
              photo: files.photo?.name,
              birth_certificate: files.birth_certificate?.name,
              transcript: files.transcript?.name,
            }}
          />
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                {...form.register("declaration")}
              />
              {tr("admission.fields.declaration")}
            </label>
            {form.formState.errors.declaration ? (
              <p className="text-destructive text-sm">
                {tr(String(form.formState.errors.declaration.message))}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Honeypot: hidden from people and screen readers. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 overflow-hidden"
      >
        <Label htmlFor="apply-website">website</Label>
        <input
          id="apply-website"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => go(step - 1)}
            disabled={busy !== ""}
          >
            {tr("admission.back")}
          </Button>
        ) : null}
        {name === "review" ? (
          <Button type="submit" disabled={busy !== ""}>
            {busy === "submitting"
              ? tr("admission.submitting")
              : busy === "uploading"
                ? tr("admission.uploading")
                : tr("admission.submit")}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            {tr("admission.next")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            if (!window.confirm(tr("admission.clearConfirm"))) return;
            form.reset(EMPTY);
            setFiles({});
            go(0);
          }}
        >
          {tr("admission.clearDraft")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {tr("admission.draftSaved")}
      </p>
    </form>
  );
}
