"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { isRole, roleHomePath, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  isBdPhone,
  loginSchema,
  newPasswordSchema,
  normalizePhone,
} from "@/lib/validation/auth";

export type ActionResult =
  { ok: true; message?: TranslationKey } | { ok: false; error: TranslationKey };

function checkLang(lang: unknown): Locale {
  if (!isLocale(lang as string)) throw new Error("Invalid language");
  return lang as Locale;
}

/** Phone login: find the email that belongs to this phone number (server only). */
async function emailForPhone(phone: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("phone", normalizePhone(phone))
    .eq("is_active", true)
    .maybeSingle();
  return data?.email ?? null;
}

export async function signIn(
  langInput: string,
  input: unknown,
): Promise<ActionResult> {
  const lang = checkLang(langInput);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "auth.invalidCredentials" };
  const { identifier, password, next } = parsed.data;

  // Same message for unknown accounts and wrong passwords, so accounts cannot be probed.
  const email = isBdPhone(identifier)
    ? await emailForPhone(identifier)
    : identifier.toLowerCase();
  if (!email) return { ok: false, error: "auth.invalidCredentials" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error?.code === "over_request_rate_limit")
    return { ok: false, error: "auth.tooMany" };
  if (error || !data.user)
    return { ok: false, error: "auth.invalidCredentials" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.is_active || !isRole(profile.role)) {
    await supabase.auth.signOut();
    return { ok: false, error: "auth.noAccess" };
  }

  if (profile.must_change_password) redirect(`/${lang}/change-password`);
  redirect(safeNextPath(next) ?? roleHomePath(lang, profile.role));
}

export async function requestPasswordReset(
  langInput: string,
  input: unknown,
): Promise<ActionResult> {
  const lang = checkLang(langInput);
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.email" };

  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(`/${lang}/reset-password`)}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email.toLowerCase(),
    { redirectTo },
  );
  if (error) console.warn(`Password reset request failed: ${error.message}`);

  // Always the same answer, whether or not the email has an account.
  return { ok: true, message: "auth.linkSent" };
}

/** Sets a new password for the logged-in user (forced change or reset link). */
export async function updatePassword(
  langInput: string,
  input: unknown,
): Promise<ActionResult> {
  const lang = checkLang(langInput);
  const user = await requireUser(lang);
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.passwordWeak" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "same_password")
      return { ok: false, error: "errors.passwordSame" };
    if (error.code === "weak_password")
      return { ok: false, error: "errors.passwordWeak" };
    return { ok: false, error: "auth.unexpected" };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (profileError) return { ok: false, error: "auth.unexpected" };

  redirect(roleHomePath(lang, user.role));
}

export async function signOut(langInput: string): Promise<void> {
  const lang = checkLang(langInput);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}/login`);
}
