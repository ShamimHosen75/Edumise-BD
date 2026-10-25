"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";

import {
  deleteContent,
  saveContent,
  uploadBodyImage,
} from "@/app/[lang]/dashboard/[module]/actions";
import { LanguageTabs } from "@/components/dashboard/cms/language-tabs";
import type { EditorLabels } from "@/components/dashboard/cms/rich-text-editor";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import type { ContentModule } from "@/lib/content/modules";
import { CONTENT_SCHEMAS } from "@/lib/validation/content";
import { slugify } from "@/lib/validation/page";

import { CheckboxField, TextField } from "./form-controls";
import { ModuleFields, type Option } from "./module-fields";
import { RichField } from "./rich-field";

type Props = {
  lang: Locale;
  module: ContentModule;
  id: number | null;
  defaults: FieldValues;
  /** Teachers save drafts only; the server enforces this too. */
  canPublish: boolean;
  classes: Option[];
  albums: Option[];
  messages: Messages;
  editorLabels: EditorLabels;
};

const HAS_SLUG: readonly ContentModule[] = [
  "notices",
  "news",
  "events",
  "gallery",
];
const HAS_BODY: readonly ContentModule[] = ["notices", "news", "events"];

/** Create / edit form for notices, news, events, albums and downloads (EN + BN). */
export function ContentForm(props: Props) {
  const { lang, module, id, canPublish, messages } = props;
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const form = useForm<FieldValues>({
    resolver: zodResolver(
      CONTENT_SCHEMAS[module],
    ) as unknown as Resolver<FieldValues>,
    defaultValues: props.defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const m = (key: string | undefined) => msg(messages, key);
  const label = (key: string) => m(`contentAdmin.fields.${key}`)!;
  const list = `/${lang}/dashboard/${module}`;

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    const result = await saveContent(lang, module, id, values).catch(() => ({
      ok: false as const,
      error: "auth.unexpected" as const,
      fieldErrors: undefined,
    }));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field, { message: key });
      setStatus({ ok: false, text: m(result.error)! });
      return;
    }
    setStatus({ ok: true, text: m("contentAdmin.saved")! });
    if (id === null) router.replace(`${list}/${result.id}`);
    else router.refresh();
  });

  const uploadImage = id
    ? async (file: File) => {
        const data = new FormData();
        data.set("file", file);
        const result = await uploadBodyImage(lang, module, id, data);
        if (!result.ok) setStatus({ ok: false, text: m(result.error)! });
        return result.ok ? result.url : null;
      }
    : undefined;

  const panel = (code: "en" | "bn") => (
    <>
      <TextField
        form={form}
        t={m}
        name={`title_${code}`}
        label={label("title")}
        lang={code}
        onChange={(value) => {
          // Suggest an address from the English title for a new item.
          if (
            code === "en" &&
            id === null &&
            HAS_SLUG.includes(module) &&
            !form.getFieldState("slug").isDirty
          )
            form.setValue("slug", slugify(value));
        }}
      />
      {module === "events" ? (
        <TextField
          form={form}
          t={m}
          name={`venue_${code}`}
          label={label("venue")}
          lang={code}
        />
      ) : null}
      {HAS_BODY.includes(module) ? (
        <RichField
          form={form}
          t={m}
          name={`body_${code}`}
          label={label("body")}
          lang={code}
          labels={props.editorLabels}
          onUploadImage={uploadImage}
        />
      ) : null}
    </>
  );
  const hasError = (code: string) =>
    Object.keys(errors).some((k) => k.endsWith(`_${code}`));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-4xl flex-col gap-6"
      aria-busy={isSubmitting}
    >
      {HAS_SLUG.includes(module) ? (
        <TextField
          form={form}
          t={m}
          name="slug"
          label={label("slug")}
          hint={label("slugHint")}
        />
      ) : null}
      <ModuleFields
        module={module}
        form={form}
        m={m}
        classes={props.classes}
        albums={props.albums}
      />
      <LanguageTabs
        label={m("cms.languageTabs")!}
        idPrefix={module}
        tabs={[
          {
            key: "en",
            label: m("cms.english")!,
            panel: panel("en"),
            hasError: hasError("en"),
          },
          {
            key: "bn",
            label: m("cms.bangla")!,
            panel: panel("bn"),
            hasError: hasError("bn"),
          },
        ]}
      />
      {canPublish ? (
        <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">
            {m("contentAdmin.status")}
          </legend>
          <div className="flex flex-col gap-1 sm:pt-6">
            <CheckboxField
              form={form}
              name="is_published"
              label={label("isPublished")}
            />
            {errors.is_published ? (
              <p className="text-destructive text-sm">
                {m(errors.is_published.message as string)}
              </p>
            ) : null}
          </div>
          <TextField
            form={form}
            t={m}
            type="datetime-local"
            name="published_at"
            label={label("publishedAt")}
            hint={label("publishedAtHint")}
          />
        </fieldset>
      ) : (
        <p className="bg-muted rounded-lg p-3 text-sm">
          {m("contentAdmin.draftOnly")}
        </p>
      )}

      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
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
              const result = await deleteContent(lang, module, id).catch(
                () => ({
                  ok: false as const,
                  error: "auth.unexpected" as const,
                }),
              );
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
