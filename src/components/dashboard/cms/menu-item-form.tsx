"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { msg, type Messages } from "@/i18n/messages";
import { menuItemSchema, type MenuItemInput } from "@/lib/validation/page";

export type PageOption = { id: number; label: string };

type Props = {
  idPrefix: string;
  defaults: MenuItemInput;
  pages: PageOption[];
  messages: Messages;
  onSubmit: (values: MenuItemInput) => Promise<{
    ok: boolean;
    error?: string;
    fieldErrors?: Record<string, string>;
  }>;
  onCancel: () => void;
};

/** Add / edit one menu item: names in both languages, what it links to, hidden or not. */
export function MenuItemForm({
  idPrefix,
  defaults,
  pages,
  messages,
  onSubmit,
  onCancel,
}: Props) {
  const [error, setError] = useState<string>();
  const form = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const linkType = form.watch("link_type");
  const m = (key: string | undefined) => msg(messages, key);
  const id = (name: string) => `${idPrefix}-${name}`;

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);
    const result = await onSubmit(values);
    if (result.ok) return;
    for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
      form.setError(field as keyof MenuItemInput, { message: key });
    setError(m(result.error ?? "auth.unexpected"));
  });

  const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="bg-muted/30 grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
      aria-busy={isSubmitting}
    >
      <FormField
        id={id("label_en")}
        label={m("cms.labelEn")!}
        error={m(errors.label_en?.message)}
      >
        {(aria) => <Input {...aria} autoFocus {...form.register("label_en")} />}
      </FormField>
      <FormField
        id={id("label_bn")}
        label={m("cms.labelBn")!}
        error={m(errors.label_bn?.message)}
      >
        {(aria) => <Input {...aria} lang="bn" {...form.register("label_bn")} />}
      </FormField>
      <FormField
        id={id("link_type")}
        label={m("cms.linkType")!}
        error={m(errors.link_type?.message)}
      >
        {(aria) => (
          <select {...aria} className={select} {...form.register("link_type")}>
            {defaults.parent_id === null ? (
              <option value="none">{m("cms.linkNone")}</option>
            ) : null}
            <option value="page">{m("cms.linkPage")}</option>
            <option value="url">{m("cms.linkUrl")}</option>
          </select>
        )}
      </FormField>
      {linkType === "page" ? (
        <FormField
          id={id("page_id")}
          label={m("cms.page")!}
          error={m(errors.page_id?.message)}
        >
          {(aria) => (
            <select
              {...aria}
              className={select}
              {...form.register("page_id", {
                setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              })}
            >
              <option value="">{m("cms.choosePage")}</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
      ) : null}
      {linkType === "url" ? (
        <FormField
          id={id("url")}
          label={m("cms.url")!}
          hint={m("cms.urlHint")}
          error={m(errors.url?.message)}
        >
          {(aria) => (
            <Input
              {...aria}
              autoCapitalize="none"
              spellCheck={false}
              {...form.register("url")}
            />
          )}
        </FormField>
      ) : null}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          {...form.register("is_hidden")}
        />
        {m("cms.hide")}
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {m("cms.saveItem")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {m("cms.cancel")}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
