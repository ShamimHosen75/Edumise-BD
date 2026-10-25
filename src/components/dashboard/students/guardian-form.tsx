"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  findGuardians,
  linkGuardian,
  type GuardianMatch,
} from "@/app/[lang]/dashboard/students/guardian-actions";
import type { Translate } from "@/components/dashboard/academic/labels";
import {
  CheckboxField,
  SelectField,
  TextField,
} from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { guardianLinkSchema, RELATIONS } from "@/lib/validation/student";

const empty = {
  guardian_id: null,
  full_name_en: "",
  full_name_bn: "",
  phone: "",
  occupation: "",
  relation: "father",
  is_primary: false,
};

/** Add a guardian: one who already has this mobile (brothers, sisters) or a new one. */
export function GuardianForm({
  lang,
  studentId,
  tr,
}: {
  lang: Locale;
  studentId: number;
  tr: Translate;
}) {
  const p = (key: string, vars?: Record<string, string>) =>
    tr(`studentProfile.${key}`, vars);
  const router = useRouter();
  const [matches, setMatches] = useState<GuardianMatch[] | null>(null);
  const [finding, startFind] = useTransition();
  const form = useForm<FieldValues>({
    resolver: zodResolver(
      guardianLinkSchema,
    ) as unknown as Resolver<FieldValues>,
    defaultValues: empty,
  });
  const base = { form, t: tr };
  const chosen = form.watch("guardian_id") as number | null;
  const { isSubmitting } = form.formState;

  const find = () =>
    startFind(async () => {
      const list = await findGuardians(lang, form.getValues("phone")).catch(
        () => [],
      );
      setMatches(list);
      form.setValue("guardian_id", list[0]?.id ?? null);
    });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await linkGuardian(lang, studentId, values).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
      fieldErrors: undefined,
    }));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      toast.error(tr(result.error));
      return;
    }
    toast.success(p("saved"));
    form.reset(empty);
    setMatches(null);
    router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting || finding}
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <h3 className="font-semibold">{p("linkGuardian")}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          {...base}
          id="guardian-phone"
          name="phone"
          label={p("phone")}
        />
        <Button
          type="button"
          variant="outline"
          onClick={find}
          disabled={finding}
        >
          {p("find")}
        </Button>
      </div>
      {matches ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {p("findGuardian")}
          </legend>
          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">{p("noMatch")}</p>
          ) : null}
          {[...matches, null].map((m) => (
            <label
              key={m?.id ?? "new"}
              className="flex items-start gap-2 text-sm"
            >
              <input
                type="radio"
                name="guardian-choice"
                className="mt-1"
                checked={chosen === (m?.id ?? null)}
                onChange={() => form.setValue("guardian_id", m?.id ?? null)}
              />
              <span>
                {m ? (
                  <>
                    <span className="font-medium">{m.name}</span>
                    {m.children.length ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {p("children")}: {m.children.join(", ")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  p("newGuardian")
                )}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {chosen === null ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            {...base}
            id="guardian-name-en"
            name="full_name_en"
            label={tr("studentProfile.fields.nameEn")}
            lang="en"
          />
          <TextField
            {...base}
            id="guardian-name-bn"
            name="full_name_bn"
            label={tr("studentProfile.fields.nameBn")}
            lang="bn"
          />
          <TextField
            {...base}
            id="guardian-occupation"
            name="occupation"
            label={p("occupation")}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <SelectField
          {...base}
          id="guardian-relation"
          name="relation"
          label={p("relation")}
          options={RELATIONS.map((r) => ({
            value: r,
            label: p(`relations.${r}`),
          }))}
        />
        <CheckboxField form={form} name="is_primary" label={p("primary")} />
      </div>
      <Button type="submit" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? tr("dialog.saving") : p("linkGuardian")}
      </Button>
    </form>
  );
}
