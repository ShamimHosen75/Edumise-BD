"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { canSetPasswordWithoutCurrent } from "@/lib/auth/password-policy";
import { isRole, roleHomePath, safeNextPath } from "@/lib/auth/roles";
import { getSessionAmr, requireUser } from "@/lib/auth/session";
import { hitRateLimit, isRateLimited } from "@/lib/rate-limit";
import { clientIp, LIMITS, rateKey } from "@/lib/rate-limit-keys";
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

/** Address used in password reset links: the configured site URL, else this request's origin. */
async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

export async function signIn(
  langInput: string,
  input: unknown,
): Promise<ActionResult> {
  const lang = checkLang(langInput);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "auth.invalidCredentials" };
  const { identifier, password, next } = parsed.data;

  // Our own limits: Supabase sees every login coming from this server, so its per-IP
  // limit cannot tell users apart. Per IP is generous (a school lab shares one address);
  // per account is strict and counts failures only.
  const ip = clientIp(await headers());
  const accountKey = rateKey(
    "login-fail",
    isBdPhone(identifier) ? normalizePhone(identifier) : identifier,
  );
  if (await hitRateLimit(rateKey("login-ip", ip), LIMITS.loginPerIp))
    return { ok: false, error: "auth.tooMany" };
  if (await isRateLimited(accountKey, LIMITS.loginFailuresPerAccount))
    return { ok: false, error: "auth.tooMany" };

  const fail = async (): Promise<ActionResult> => {
    await hitRateLimit(accountKey, LIMITS.loginFailuresPerAccount);
    return { ok: false, error: "auth.invalidCredentials" };
  };

  // Same message for unknown accounts and wrong passwords, so accounts cannot be probed.
  const email = isBdPhone(identifier)
    ? await emailForPhone(identifier)
    : identifier.toLowerCase();
  if (!email) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error?.code === "over_request_rate_limit")
    return { ok: false, error: "auth.tooMany" };
  if (error || !data.user) return fail();

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
  const email = parsed.data.email.toLowerCase();

  // Stops the form being used to flood someone's inbox. Over the limit, the answer looks
  // the same as usual, so it reveals nothing about the account.
  const ip = clientIp(await headers());
  const ipLimited = await hitRateLimit(
    rateKey("reset-ip", ip),
    LIMITS.resetPerIp,
  );
  const emailLimited = await hitRateLimit(
    rateKey("reset-email", email),
    LIMITS.resetPerEmail,
  );
  if (ipLimited) return { ok: false, error: "auth.tooMany" };

  if (!emailLimited) {
    const redirectTo = `${await siteUrl()}/api/auth/callback?next=${encodeURIComponent(`/${lang}/reset-password`)}`;
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) console.warn(`Password reset request failed: ${error.message}`);
  }

  // Always the same answer, whether or not the email has an account.
  return { ok: true, message: "auth.linkSent" };
}

/**
 * Sets a new password without the current one. Allowed only for a school-forced change or
 * right after a reset link, so a stolen session cannot change the password.
 */
export async function updatePassword(
  langInput: string,
  input: unknown,
): Promise<ActionResult> {
  const lang = checkLang(langInput);
  const user = await requireUser(lang);
  const amr = await getSessionAmr();
  if (
    !canSetPasswordWithoutCurrent({
      mustChangePassword: user.mustChangePassword,
      amr,
      nowSeconds: Date.now() / 1000,
    })
  ) {
    return { ok: false, error: "auth.linkExpired" };
  }
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

  // Users cannot clear this flag themselves (database rule); the server does it here.
  if (user.mustChangePassword) {
    const { error: profileError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (profileError) return { ok: false, error: "auth.unexpected" };
  }

  redirect(roleHomePath(lang, user.role));
}

export async function signOut(langInput: string): Promise<void> {
  const lang = checkLang(langInput);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}/login`);
}
