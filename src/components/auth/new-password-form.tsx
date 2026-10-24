"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { updatePassword } from "@/app/[lang]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import {
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/validation/auth";

type Props = { lang: Locale; messages: Messages };

/** Used for both the forced first-login change and the reset-link page. */
export function NewPasswordForm({ lang, messages }: Props) {
  const [serverError, setServerError] = useState<string>();
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await updatePassword(lang, values);
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
        <p role="alert" className="text-destructive text-sm">
          {msg(messages, serverError)}
        </p>
      ) : null}
      <FormField
        id="password"
        label={msg(messages, "auth.newPassword")!}
        hint={msg(messages, "auth.passwordHint")}
        error={msg(messages, errors.password?.message)}
      >
        {(aria) => (
          <Input
            {...aria}
            type="password"
            autoComplete="new-password"
            autoFocus
            {...form.register("password")}
          />
        )}
      </FormField>
      <FormField
        id="confirm"
        label={msg(messages, "auth.confirmPassword")!}
        error={msg(messages, errors.confirm?.message)}
      >
        {(aria) => (
          <Input
            {...aria}
            type="password"
            autoComplete="new-password"
            {...form.register("confirm")}
          />
        )}
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? msg(messages, "auth.saving")
          : msg(messages, "auth.savePassword")}
      </Button>
    </form>
  );
}
