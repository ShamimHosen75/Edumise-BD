"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { signIn } from "@/app/[lang]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

type Props = {
  lang: Locale;
  next?: string;
  initialError?: string;
  messages: Messages;
};

export function LoginForm({ lang, next, initialError, messages }: Props) {
  const [serverError, setServerError] = useState<string | undefined>(
    initialError,
  );
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", next },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(undefined);
    // On success the action redirects, so a returned value is always an error.
    const result = await signIn(lang, values);
    if (result && !result.ok) setServerError(result.error);
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-busy={isSubmitting}
    >
      {serverError ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {msg(messages, serverError)}
        </p>
      ) : null}
      <FormField
        id="identifier"
        label={msg(messages, "auth.identifier")!}
        error={msg(messages, errors.identifier?.message)}
      >
        {(aria) => (
          <Input
            {...aria}
            type="text"
            inputMode="email"
            autoComplete="username"
            autoFocus
            {...form.register("identifier")}
          />
        )}
      </FormField>
      <FormField
        id="password"
        label={msg(messages, "auth.password")!}
        error={msg(messages, errors.password?.message)}
      >
        {(aria) => (
          <Input
            {...aria}
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        )}
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? msg(messages, "auth.submitting")
          : msg(messages, "auth.submit")}
      </Button>
      <Link
        href={`/${lang}/forgot-password`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {msg(messages, "auth.forgot")}
      </Link>
    </form>
  );
}
