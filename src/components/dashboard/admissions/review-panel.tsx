"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  approveApplication,
  retryGuardianLogin,
  saveReview,
  type GuardianLogin,
} from "@/app/[lang]/dashboard/admissions/actions";
import { translator } from "@/components/dashboard/academic/labels";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";
import { reviewSchema } from "@/lib/validation/admission";

const REVIEW_STATUSES = [
  "submitted",
  "under_review",
  "test_scheduled",
  "rejected",
  "waitlisted",
];

/** Office review (status, test, marks) and approval into a section. */
export function ReviewPanel({
  lang,
  id,
  name,
  approved,
  studentCode,
  defaults,
  sections,
  messages,
}: {
  lang: Locale;
  id: number;
  name: string;
  approved: boolean;
  studentCode: string | null;
  defaults: FieldValues;
  sections: { id: number; name: string }[];
  messages: Messages;
}) {
  const tr = translator(messages);
  const a = (key: string, vars?: Record<string, string | number>) =>
    tr(`admissionsAdmin.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? 0);
  const [login, setLogin] = useState<GuardianLogin | null>(null);
  const [enrolled, setEnrolled] = useState<string | null>(null);
  const form = useForm<FieldValues>({
    resolver: zodResolver(reviewSchema) as unknown as Resolver<FieldValues>,
    defaultValues: defaults,
  });
  const base = { form, t: tr };

  const save = form.handleSubmit((values) =>
    start(async () => {
      const result = await saveReview(lang, id, values).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
        fieldErrors: undefined,
      }));
      if (!result.ok) {
        for (const [f, key] of Object.entries(result.fieldErrors ?? {}))
          form.setError(f, { message: key });
        return void toast.error(tr(result.error));
      }
      toast.success(a("saved"));
      router.refresh();
    }),
  );

  const approve = () => {
    const section = sections.find((s) => s.id === sectionId)?.name ?? "";
    if (!window.confirm(a("approveConfirm", { name, section }))) return;
    start(async () => {
      const result = await approveApplication(lang, id, sectionId).catch(
        () => ({
          ok: false as const,
          error: "auth.unexpected" as const,
        }),
      );
      if (!result.ok) return void toast.error(tr(result.error));
      setEnrolled(
        a("approved", {
          name,
          code: result.studentCode,
          roll: localizeDigits(result.roll, lang),
        }),
      );
      setLogin(result.login);
      router.refresh();
    });
  };

  const retry = () =>
    start(async () => {
      const result = await retryGuardianLogin(lang, id).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      setLogin(result.login);
    });

  return (
    <div className="flex flex-col gap-6">
      {!approved ? (
        <form
          onSubmit={save}
          noValidate
          aria-busy={pending}
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <h2 className="font-semibold">{a("review")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              {...base}
              name="status"
              label={a("status")}
              options={REVIEW_STATUSES.map((s) => ({
                value: s,
                label: tr(`admission.statuses.${s}`),
              }))}
            />
            <TextField
              {...base}
              type="number"
              name="test_marks"
              label={a("marks")}
            />
            <TextField
              {...base}
              type="datetime-local"
              name="test_at"
              label={a("testAt")}
            />
            <TextField {...base} name="test_venue" label={a("testVenue")} />
          </div>
          <TextAreaField
            {...base}
            name="office_note"
            label={a("officeNote")}
            rows={2}
          />
          <Button type="submit" className="w-fit" disabled={pending}>
            {a("saveReview")}
          </Button>
        </form>
      ) : null}

      <section
        aria-labelledby="approve-title"
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <h2 id="approve-title" className="font-semibold">
          {approved ? a("guardianLogin") : a("approve")}
        </h2>
        {enrolled ? (
          <p role="status" className="font-medium">
            {enrolled}
          </p>
        ) : approved && studentCode ? (
          <p>{a("enrolledAs", { code: studentCode })}</p>
        ) : null}
        {!approved ? (
          <>
            <p className="text-muted-foreground text-sm">{a("approveIntro")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="approve-section">{a("section")}</Label>
                <select
                  id="approve-section"
                  className="bg-background h-10 rounded-md border px-3 text-sm"
                  value={sectionId}
                  onChange={(e) => setSectionId(Number(e.target.value))}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={approve}
                disabled={pending || !sectionId}
              >
                {a("approveButton")}
              </Button>
            </div>
          </>
        ) : null}

        {login?.status === "created" ? (
          <div
            role="status"
            className="bg-muted flex flex-col gap-2 rounded-lg p-3"
          >
            <p className="text-sm">
              {a("guardianLoginIntro", {
                phone: localizeDigits(login.phone, lang),
              })}
            </p>
            <code
              data-testid="guardian-password"
              className="bg-background w-fit rounded border px-3 py-1.5 font-mono text-lg"
            >
              {login.password}
            </code>
            <p className="text-muted-foreground text-xs">
              {tr("staff.oneTimeHint")}
            </p>
          </div>
        ) : null}
        {login?.status === "exists" ? (
          <p role="status" className="text-sm">
            {a("guardianLoginExists", {
              phone: localizeDigits(login.phone, lang),
            })}
          </p>
        ) : null}
        {login?.status === "failed" ? (
          <p role="alert" className="text-destructive text-sm">
            {a("guardianLoginFailed")}
          </p>
        ) : null}
        {approved && (!login || login.status === "failed") ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={retry}
            disabled={pending}
          >
            {a("createGuardianLogin")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
