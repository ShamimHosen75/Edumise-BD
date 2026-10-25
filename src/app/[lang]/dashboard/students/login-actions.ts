"use server";

import type { TranslationKey } from "@/i18n/t";
import { requireAdmin, type ActionResult } from "@/lib/actions";
import {
  createGuardianLogin,
  createStudentLogin,
  resetFamilyPassword,
} from "@/lib/auth/linked-login";
import { assertId } from "@/lib/validation/ids";

export type FamilyKind = "student" | "guardian";
export type FamilyLoginResult =
  { ok: true; password: string | null } | { ok: false; error: TranslationKey };

const kinds = ["student", "guardian"] as const;
function check(kind: unknown, id: number): asserts kind is FamilyKind {
  assertId(id);
  if (!kinds.includes(kind as FamilyKind)) throw new Error("Invalid request");
}

async function profileOf(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  kind: FamilyKind,
  id: number,
) {
  const { data } = await supabase
    .from(kind === "student" ? "students" : "guardians")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();
  return data?.profile_id ?? null;
}

/**
 * Creates a login (student: student ID; guardian: mobile number) or gives the existing one
 * a new one-time password. The password is returned once, to show to the admin.
 * password = null: a guardian with this mobile already had a login, now linked.
 */
export async function familyLogin(
  lang: string,
  kind: FamilyKind,
  id: number,
  op: "create" | "reset",
): Promise<FamilyLoginResult> {
  check(kind, id);
  if (op !== "create" && op !== "reset") throw new Error("Invalid request");
  const supabase = await requireAdmin(lang);
  let password: string | null = null;
  if (op === "create") {
    const login =
      kind === "student"
        ? await createStudentLogin(id)
        : await createGuardianLogin(id);
    if (login.status === "failed")
      return {
        ok: false,
        error: kind === "guardian" ? "errors.phoneTaken" : "auth.unexpected",
      };
    if (login.status === "created") password = login.password;
  } else {
    const profileId = await profileOf(supabase, kind, id);
    if (!profileId) return { ok: false, error: "errors.notAllowed" };
    password = await resetFamilyPassword(profileId);
    if (!password) return { ok: false, error: "auth.unexpected" };
  }
  await supabase.rpc("record_audit", {
    p_action: `${kind}.login.${op}`,
    p_entity: kind,
    p_entity_id: String(id),
    p_details: {},
  });
  return { ok: true, password };
}

/** Switches a student or guardian login off (cannot sign in) or on again. */
export async function setFamilyLoginActive(
  lang: string,
  kind: FamilyKind,
  id: number,
  active: boolean,
): Promise<ActionResult> {
  check(kind, id);
  if (typeof active !== "boolean") throw new Error("Invalid request");
  const supabase = await requireAdmin(lang);
  const profileId = await profileOf(supabase, kind, id);
  if (!profileId) return { ok: false, error: "errors.notAllowed" };
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profileId)
    .in("role", ["student", "guardian"])
    .select("id");
  if (error || !data.length) return { ok: false, error: "errors.notAllowed" };
  return { ok: true };
}
