"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { sendContactMessage } from "@/app/[lang]/(site)/contact/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { contactSchema, type ContactInput } from "@/lib/validation/people";

const EMPTY: ContactInput = {
  name: "",
  phone: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

/** Public contact form. Checked here for quick feedback and again on the server. */
export function ContactForm({
  lang,
  messages,
}: {
  lang: Locale;
  messages: Messages;
}) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY,
  });
  const { errors, isSubmitting } = form.formState;
  const m = (key: string | undefined) => msg(messages, key);

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    const result = await sendContactMessage(lang, {
      ...values,
      // Read the honeypot from the page: autofill can set it without React knowing.
      website: form.getValues("website"),
    }).catch(() => ({ ok: false as const, error: "auth.unexpected" as const }));
    if (!result.ok) {
      if ("fieldErrors" in result)
        for (const [field, key] of Object.entries(result.fieldErrors ?? {}))
          form.setError(field as keyof ContactInput, { message: key });
      setStatus({ ok: false, text: m(result.error)! });
      return;
    }
    form.reset(EMPTY);
    setStatus({ ok: true, text: m("contact.sent")! });
  });

  const field = (
    name: Exclude<keyof ContactInput, "website" | "message">,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <FormField
      id={`contact-${name}`}
      label={m(`contact.${name}`)!}
      error={m(errors[name]?.message)}
    >
      {(aria) => <Input {...aria} {...props} {...form.register(name)} />}
    </FormField>
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="flex flex-col gap-4"
    >
      {field("name", { autoComplete: "name" })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
        {field("email", { type: "email", autoComplete: "email" })}
      </div>
      {field("subject")}
      <FormField
        id="contact-message"
        label={m("contact.message")!}
        error={m(errors.message?.message)}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={6}
            maxLength={2000}
            {...form.register("message")}
          />
        )}
      </FormField>
      {/* Honeypot: hidden from people and screen readers; bots fill every field. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 overflow-hidden"
      >
        <label htmlFor="contact-website">{m("contact.website")}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? m("contact.sending") : m("contact.send")}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={
            status?.ok === false
              ? "text-destructive text-sm"
              : "text-sm font-medium text-green-700 dark:text-green-400"
          }
        >
          {status?.text}
        </p>
      </div>
    </form>
  );
}
