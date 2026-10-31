"use server";

import { setLoginBlocked } from "@/lib/auth/ban";
import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { invalid, type ActionResult } from "@/lib/actions";
import { canManageLogin } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { tempPassword } from "@/lib/auth/temp-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertId } from "@/lib/validation/ids";
import { staffLoginSchema } from "@/lib/validation/staff";

/** A new one-time password is returned once, to show to the admin. */
export type PasswordResult =
  | { ok: true; password: string }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Record<string, TranslationKey>;
    };

async function admin(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const me = await requireRole(lang, ["super_admin", "admin"]);
  return { me, supabase: await createClient() };
}

/**
 * Creates a login for a member of staff with a one-time password (they must change it
 * at first sign-in). Account creation needs the service role, used here on the server
 * only after the admin check.
 */
export async function createStaffLogin(
  lang: string,
  staffId: number,
  input: unknown,
): Promise<PasswordResult> {
  assertId(staffId);
  const { me, supabase } = await admin(lang);
  const parsed = staffLoginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as PasswordResult;
  const { email, phone, role } = parsed.data;
  if (role === "admin" && me.role !== "super_admin")
    return {
      ok: false,
      error: "errors.roleNotAllowed",
      fieldErrors: { role: "errors.roleNotAllowed" },
    };

  const { data: staff } = await supabase
    .from("staff")
    .select("profile_id, full_name_en, full_name_bn")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff) return { ok: false, error: "errors.notAllowed" };
  if (staff.profile_id) return { ok: false, error: "errors.hasLogin" };

  const service = createAdminClient();
  if (phone) {
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone);
    if (count)
      return {
        ok: false,
        error: "errors.phoneTaken",
        fieldErrors: { phone: "errors.phoneTaken" },
      };
  }

  const password = tempPassword();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return taken
      ? {
          ok: false,
          error: "errors.emailTaken",
          fieldErrors: { email: "errors.emailTaken" },
        }
      : { ok: false, error: "auth.unexpected" };
  }
  // Supabase stores app_metadata after the profile trigger has run, so the role and
  // names are set on the profile here (the service role may; nobody else can).
  const { error: profileError } = await service
    .from("profiles")
    .update({
      role,
      phone: phone || null,
      full_name_en: staff.full_name_en,
      full_name_bn: staff.full_name_bn,
      must_change_password: true,
      is_active: true,
    })
    .eq("id", created.user.id);
  const { error: linkError } = profileError
    ? { error: profileError }
    : await service
        .from("staff")
        .update({ profile_id: created.user.id })
        .eq("id", staffId)
        .is("profile_id", null);
  if (linkError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "auth.unexpected" };
  }
  return { ok: true, password };
}

/** Gives a staff login a new one-time password. */
export async function resetStaffPassword(
  lang: string,
  staffId: number,
): Promise<PasswordResult> {
  assertId(staffId);
  const { me, supabase } = await admin(lang);
  const { data: staff } = await supabase
    .from("staff")
    .select("profile:profiles(id, role)")
    .eq("id", staffId)
    .maybeSingle();
  const profile = staff?.profile as unknown as {
    id: string;
    role: string;
  } | null;
  if (!profile) return { ok: false, error: "errors.notAllowed" };
  // Admins cannot take over another admin's or a super admin's account.
  if (!canManageLogin(me, profile))
    return { ok: false, error: "errors.notAllowed" };

  const service = createAdminClient();
  const password = tempPassword();
  const { error } = await service.auth.admin.updateUserById(profile.id, {
    password,
  });
  if (error) return { ok: false, error: "auth.unexpected" };
  await service
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profile.id);
  return { ok: true, password };
}

/** Switches a staff login on or off (off: they can no longer sign in to anything). */
export async function setStaffLoginActive(
  lang: string,
  staffId: number,
  active: boolean,
): Promise<ActionResult> {
  assertId(staffId);
  if (typeof active !== "boolean") throw new Error("Invalid request");
  const { me, supabase } = await admin(lang);
  const { data: staff } = await supabase
    .from("staff")
    .select("profile:profiles(id, role)")
    .eq("id", staffId)
    .maybeSingle();
  const profile = staff?.profile as unknown as {
    id: string;
    role: string;
  } | null;
  if (!profile || !canManageLogin(me, profile))
    return { ok: false, error: "errors.notAllowed" };
  // The admin's own client: RLS and the profile guard stop changes to super admins.
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profile.id)
    .select("id");
  if (error || !data.length) return { ok: false, error: "errors.notAllowed" };
  if (!(await setLoginBlocked(profile.id, !active)))
    return { ok: false, error: "auth.unexpected" };
  return { ok: true };
}
