"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  deletePage,
  savePage,
  uploadPageImage,
} from "@/app/[lang]/dashboard/pages/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { pageSchema, slugify, type PageInput } from "@/lib/validation/page";

import { LanguageTabs } from "./language-tabs";
import { RichTextEditor, type EditorLabels } from "./rich-text-editor";

type Props = {
  lang: Locale;
  id: number | null;
  defaults: PageInput;
  messages: Messages;
  editorLabels: EditorLabels;
};

export function PageEditor({
  lang,
  id,
  defaults,
  messages,
  editorLabels,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const form = useForm<PageInput>({
    resolver: zodResolver(pageSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const m = (key: string | undefined) => msg(messages, key);

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    const result = await savePage(lang, id, values);
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
        form.setError(field as keyof PageInput, { message: key });
      setStatus({ ok: false, text: m(result.error)! });
      return;
    }
    setStatus({ ok: true, text: m("cms.saved")! });
    if (id === null) router.replace(`/${lang}/dashboard/pages/${result.id}`);
    else router.refresh();
  });

  const uploadImage = id
    ? async (file: File) => {
        const data = new FormData();
        data.set("file", file);
        const result = await uploadPageImage(lang, id, data);
        if (!result.ok) setStatus({ ok: false, text: m(result.error)! });
        return result.ok ? result.url : null;
      }
    : undefined;

  const languagePanel = (code: "en" | "bn") => {
    const f = (name: string) => `${name}_${code}` as keyof PageInput;
    return (
      <>
        <FormField
          id={`title_${code}`}
          label={m("cms.titleField")!}
          error={m(errors[f("title")]?.message)}
        >
          {(aria) => (
            <Input
              {...aria}
              lang={code}
              {...form.register(f("title"), {
                onChange: (e) => {
                  // Suggest an address from the English title for a new page.
                  if (
                    code === "en" &&
                    id === null &&
                    !form.getFieldState("slug").isDirty
                  ) {
                    form.setValue("slug", slugify(e.target.value));
                  }
                },
              })}
            />
          )}
        </FormField>
        <FormField
          id={`body_${code}`}
          label={m("cms.bodyField")!}
          error={m(errors[f("body")]?.message)}
        >
          {(aria) => (
            <Controller
              control={form.control}
              name={f("body")}
              render={({ field }) => (
                <RichTextEditor
                  id={aria.id}
                  lang={code}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  labels={editorLabels}
                  invalid={aria["aria-invalid"]}
                  describedBy={aria["aria-describedby"]}
                  onUploadImage={uploadImage}
                />
              )}
            />
          )}
        </FormField>
        <FormField
          id={`seo_title_${code}`}
          label={m("cms.seoTitle")!}
          hint={m("cms.seoHint")}
          error={m(errors[f("seo_title")]?.message)}
        >
          {(aria) => (
            <Input
              {...aria}
              lang={code}
              maxLength={70}
              {...form.register(f("seo_title"))}
            />
          )}
        </FormField>
        <FormField
          id={`seo_description_${code}`}
          label={m("cms.seoDescription")!}
          error={m(errors[f("seo_description")]?.message)}
        >
          {(aria) => (
            <Textarea
              {...aria}
              lang={code}
              rows={2}
              maxLength={160}
              {...form.register(f("seo_description"))}
            />
          )}
        </FormField>
      </>
    );
  };

  const hasError = (code: string) =>
    Object.keys(errors).some((k) => k.endsWith(`_${code}`));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-4xl flex-col gap-6"
      aria-busy={isSubmitting}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="slug"
          label={m("cms.slugField")!}
          hint={m("cms.slugHint")}
          error={m(errors.slug?.message)}
        >
          {(aria) => (
            <Input
              {...aria}
              autoCapitalize="none"
              spellCheck={false}
              {...form.register("slug")}
            />
          )}
        </FormField>
        <div className="flex flex-col gap-1.5 sm:pt-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              {...form.register("is_published")}
            />
            {m("cms.publish")}
          </label>
          <p className="text-muted-foreground text-xs">
            {m("cms.publishHint")}
          </p>
        </div>
      </div>

      <LanguageTabs
        label={m("cms.languageTabs")!}
        idPrefix="page"
        tabs={[
          {
            key: "en",
            label: m("cms.english")!,
            panel: languagePanel("en"),
            hasError: hasError("en"),
          },
          {
            key: "bn",
            label: m("cms.bangla")!,
            panel: languagePanel("bn"),
            hasError: hasError("bn"),
          },
        ]}
      />

      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? m("cms.saving") : m("cms.save")}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${lang}/dashboard/pages`}>{m("cms.backToPages")}</Link>
        </Button>
        {id !== null ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!window.confirm(m("cms.deleteConfirm"))) return;
              const result = await deletePage(lang, id);
              if (result.ok) router.replace(`/${lang}/dashboard/pages`);
              else setStatus({ ok: false, text: m(result.error)! });
            }}
          >
            {m("cms.delete")}
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
