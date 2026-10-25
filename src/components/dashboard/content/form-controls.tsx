"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Small field helpers for the content form. All values live in one react-hook-form.

type Form = UseFormReturn<FieldValues>;
export type Base = {
  form: Form;
  name: string;
  /** Element id; defaults to the field name (set it when two forms share a page). */
  id?: string;
  label: string;
  /** Translates an error key from the schema. */
  t: (key: string | undefined) => string | undefined;
  hint?: string;
};

export const errorOf = (form: Form, name: string) =>
  form.formState.errors[name]?.message as string | undefined;

export function TextField({
  form,
  name,
  id,
  label,
  t,
  hint,
  lang,
  type = "text",
  onChange,
}: Base & {
  lang?: "en" | "bn";
  type?: "text" | "datetime-local" | "date" | "number" | "time";
  onChange?: (value: string) => void;
}) {
  return (
    <FormField
      id={id ?? name}
      label={label}
      hint={hint}
      error={t(errorOf(form, name))}
    >
      {(aria) => (
        <Input
          {...aria}
          lang={lang}
          type={type}
          {...form.register(name, {
            onChange: onChange
              ? (e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(e.target.value)
              : undefined,
          })}
        />
      )}
    </FormField>
  );
}

export function SelectField({
  form,
  name,
  id,
  label,
  t,
  hint,
  options,
  numeric = false,
  empty,
}: Base & {
  options: { value: string | number; label: string }[];
  /** Store the value as a number (or null for the empty option). */
  numeric?: boolean;
  /** Label of an empty first option. */
  empty?: string;
}) {
  return (
    <FormField
      id={id ?? name}
      label={label}
      hint={hint}
      error={t(errorOf(form, name))}
    >
      {(aria) => (
        <select
          {...aria}
          className="bg-background aria-invalid:border-destructive h-10 rounded-md border px-3 text-sm"
          {...form.register(name, {
            setValueAs: numeric
              ? (v: unknown) =>
                  v === "" || v === null || v === undefined ? null : Number(v)
              : undefined,
          })}
        >
          {empty !== undefined ? <option value="">{empty}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

export function CheckboxField({ form, name, label, hint }: Omit<Base, "t">) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          {...form.register(name)}
        />
        {label}
      </label>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function TextAreaField({
  form,
  name,
  id,
  label,
  t,
  hint,
  lang,
  rows = 3,
  maxLength,
}: Base & { lang?: "en" | "bn"; rows?: number; maxLength?: number }) {
  return (
    <FormField
      id={id ?? name}
      label={label}
      hint={hint}
      error={t(errorOf(form, name))}
    >
      {(aria) => (
        <Textarea
          {...aria}
          lang={lang}
          rows={rows}
          maxLength={maxLength}
          {...form.register(name)}
        />
      )}
    </FormField>
  );
}
