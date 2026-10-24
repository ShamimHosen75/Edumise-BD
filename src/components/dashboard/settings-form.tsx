"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { updateSchoolSettings } from "@/app/[lang]/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import {
  schoolSettingsSchema,
  type SchoolSettingsField,
} from "@/lib/validation/school-settings";

import { SETTINGS_GROUPS, type FieldSpec } from "./settings-fields";

type FormInput = z.input<typeof schoolSettingsSchema>;
type FormOutput = z.output<typeof schoolSettingsSchema>;

type Props = {
  lang: Locale;
  defaults: FormInput;
  logoUrl: string | null;
  messages: Messages;
};

export function SettingsForm({ lang, defaults, logoUrl, messages }: Props) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [logoError, setLogoError] = useState<string>();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    setLogoError(undefined);
    const data = new FormData();
    for (const [key, value] of Object.entries(values))
      data.set(key, value == null ? "" : String(value));
    const logo = logoRef.current?.files?.[0];
    if (logo) data.set("logo", logo);

    const result = await updateSchoolSettings(lang, data);
    if (result.ok) {
      setStatus({ ok: true, text: msg(messages, "settings.saved")! });
      if (logoRef.current) logoRef.current.value = "";
      return;
    }
    for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
      if (field === "logo") setLogoError(key);
      else form.setError(field as SchoolSettingsField, { message: key });
    }
    setStatus({ ok: false, text: msg(messages, result.error)! });
  });

  const control = (
    spec: FieldSpec,
    aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string },
  ) => {
    // The saved value is also written into the HTML: the form arrives filled in, and a
    // colour input never falls back to black before the form library starts.
    const common = {
      ...aria,
      lang: spec.lang,
      defaultValue: String(defaults[spec.name] ?? ""),
      ...form.register(spec.name),
    };
    if (spec.kind === "textarea")
      return (
        <Textarea
          {...common}
          rows={spec.name.startsWith("head_message") ? 6 : 3}
        />
      );
    if (spec.kind === "color")
      return <Input {...common} type="color" className="h-10 w-20 p-1" />;
    if (spec.kind === "number")
      return <Input {...common} type="number" inputMode="numeric" min={1800} />;
    return <Input {...common} type={spec.kind} />;
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-3xl flex-col gap-8"
      aria-busy={isSubmitting}
    >
      {SETTINGS_GROUPS.map((group) => (
        <fieldset
          key={group.key}
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <legend className="px-1 font-semibold">
            {msg(messages, `settings.groups.${group.key}`)}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((spec) => (
              <div
                key={spec.name}
                className={
                  spec.kind === "textarea" ? "sm:col-span-2" : undefined
                }
              >
                <FormField
                  id={spec.name}
                  label={msg(messages, `settings.fields.${spec.name}`)!}
                  error={msg(messages, errors[spec.name]?.message)}
                >
                  {(aria) => control(spec, aria)}
                </FormField>
              </div>
            ))}
            {group.key === "branding" ? (
              <div className="sm:col-span-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small preview of an uploaded file
                  <img
                    src={logoUrl}
                    alt={msg(messages, "settings.currentLogo")}
                    className="mb-2 size-16 object-contain"
                  />
                ) : null}
                <FormField
                  id="logo"
                  label={msg(messages, "settings.logo")!}
                  hint={msg(messages, "settings.logoHint")}
                  error={msg(messages, logoError)}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      ref={logoRef}
                      type="file"
                      name="logo"
                      accept="image/png,image/jpeg,image/webp"
                    />
                  )}
                </FormField>
              </div>
            ) : null}
          </div>
        </fieldset>
      ))}
      <div className="bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? msg(messages, "settings.saving")
            : msg(messages, "settings.save")}
        </Button>
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
