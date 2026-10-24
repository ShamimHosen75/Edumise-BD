"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { requestPasswordReset } from "@/app/[lang]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";

type Props = { lang: Locale; messages: Messages };

export function ForgotPasswordForm({ lang, messages }: Props) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setStatus(null);
    const result = await requestPasswordReset(lang, values);
    setStatus(
      result.ok
        ? { ok: true, text: msg(messages, result.message ?? "auth.linkSent")! }
        : { ok: false, text: msg(messages, result.error)! },
    );
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-busy={isSubmitting}
    >
      <p
        role="status"
        aria-live="polite"
        className={
          status
            ? status.ok
              ? "text-sm"
              : "text-destructive text-sm"
            : "sr-only"
        }
      >
        {status?.text}
      </p>
      <FormField
        id="email"
        label={msg(messages, "auth.email")!}
        error={msg(messages, errors.email?.message)}
      >
        {(aria) => (
          <Input
            {...aria}
            type="email"
            autoComplete="email"
            autoFocus
            {...form.register("email")}
          />
        )}
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? msg(messages, "auth.sending")
          : msg(messages, "auth.sendLink")}
      </Button>
      <Link
        href={`/${lang}/login`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {msg(messages, "auth.backToLogin")}
      </Link>
    </form>
  );
}
