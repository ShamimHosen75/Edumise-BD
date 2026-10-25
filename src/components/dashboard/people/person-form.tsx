"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";

import {
  deletePerson,
  savePerson,
} from "@/app/[lang]/dashboard/people-actions";
import { TextField } from "@/components/dashboard/content/form-controls";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { PEOPLE_SCHEMAS, type PeopleKind } from "@/lib/people-admin";

/** Create / edit a governing body member or a former head teacher. */
export function PersonForm({
  lang,
  kind,
  id,
  defaults,
  messages,
}: {
  lang: Locale;
  kind: PeopleKind;
  id: number | null;
  defaults: FieldValues;
  messages: Messages;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const form = useForm<FieldValues>({
    resolver: zodResolver(
      PEOPLE_SCHEMAS[kind],
    ) as unknown as Resolver<FieldValues>,
    defaultValues: defaults,
  });
  const { isSubmitting } = form.formState;
  const m = (key: string | undefined) => msg(messages, key);
  const label = (key: string) => m(`peopleAdmin.${key}`)!;
  const list = `/${lang}/dashboard/${kind}`;
  const field = (
    name: string,
    labelKey: string,
    extra: Partial<Parameters<typeof TextField>[0]> = {},
  ) => (
    <TextField
      form={form}
      t={m}
      name={name}
      label={label(labelKey)}
      {...extra}
    />
  );
  const both = (base: string, labelKey: string) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {field(`${base}_en`, labelKey, {
        lang: "en",
        label: `${label(labelKey)} (${m("cms.english")})`,
      })}
      {field(`${base}_bn`, labelKey, {
        lang: "bn",
        label: `${label(labelKey)} (${m("cms.bangla")})`,
      })}
    </div>
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    const result = await savePerson(lang, kind, id, values).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
      fieldErrors: undefined,
    }));
    if (!result.ok) {
      for (const [name, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(name, { message: key });
      setStatus({ ok: false, text: m(result.error)! });
      return;
    }
    setStatus({ ok: true, text: m("contentAdmin.saved")! });
    if (id === null) router.replace(`${list}/${result.id}`);
    else router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="flex max-w-3xl flex-col gap-4"
    >
      {both("full_name", "name")}
      {kind === "governing-body" ? (
        <>
          {both("position", "position")}
          <div className="grid gap-4 sm:grid-cols-3">
            {field("term_start", "termStart", { type: "date" })}
            {field("term_end", "termEnd", {
              type: "date",
              hint: label("termEndHint"),
            })}
            {field("sort_order", "sortOrder", { type: "number" })}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("from_year", "fromYear", { type: "number" })}
            {field("to_year", "toYear", { type: "number" })}
          </div>
          {both("note", "note")}
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? m("contentAdmin.saving") : m("contentAdmin.save")}
        </Button>
        <Button asChild variant="outline">
          <Link href={list}>{m("contentAdmin.backToList")}</Link>
        </Button>
        {id !== null ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!window.confirm(m("contentAdmin.deleteConfirm"))) return;
              const result = await deletePerson(lang, kind, id).catch(() => ({
                ok: false as const,
                error: "auth.unexpected" as const,
              }));
              if (result.ok) router.replace(list);
              else setStatus({ ok: false, text: m(result.error)! });
            }}
          >
            {m("contentAdmin.delete")}
          </Button>
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className={
            status?.ok === false ? "text-destructive text-sm" : "text-sm"
          }
        >
          {status?.text}
        </p>
      </div>
    </form>
  );
}
