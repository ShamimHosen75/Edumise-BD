import "server-only";

import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import type { Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

import { isRole, type Role } from "./roles";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullNameEn: string;
  fullNameBn: string;
  mustChangePassword: boolean;
};

type AuthState = { signedIn: boolean; user: CurrentUser | null };

/**
 * The session and profile for this request. getUser() asks Supabase Auth to confirm the
 * session, so a forged or revoked cookie is never trusted. Cached per request.
 * signedIn without user = a valid login whose profile has no role or is deactivated.
 */
const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name_en, full_name_bn, must_change_password, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_active || !isRole(profile.role))
    return { signedIn: true, user: null };

  return {
    signedIn: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      role: profile.role,
      fullNameEn: profile.full_name_en,
      fullNameBn: profile.full_name_bn,
      mustChangePassword: profile.must_change_password,
    },
  };
});

/** The logged-in user with a usable role, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getAuthState()).user;
}

/**
 * Use in layouts, pages and server actions: logged out -> login page. A login without a
 * usable profile goes to login with ?error=noaccess, which also stops the login page from
 * sending it back to the dashboard (no redirect loop).
 */
export async function requireUser(lang: Locale): Promise<CurrentUser> {
  const { signedIn, user } = await getAuthState();
  if (user) return user;
  redirect(signedIn ? `/${lang}/login?error=noaccess` : `/${lang}/login`);
}

/** Use in layouts, pages and server actions: wrong role -> 403 page. */
export async function requireRole(
  lang: Locale,
  roles: readonly Role[],
): Promise<CurrentUser> {
  const user = await requireUser(lang);
  if (!roles.includes(user.role)) forbidden();
  return user;
}
