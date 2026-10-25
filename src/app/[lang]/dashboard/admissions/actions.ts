"use server";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { dbError, invalid, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth/session";
import { tempPassword } from "@/lib/auth/temp-password";
import { fromDhakaInput } from "@/lib/content/datetime";
import { TAGS } from "@/lib/site/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reviewSchema } from "@/lib/validation/admission";
import { assertId } from "@/lib/validation/ids";

type Failure = {
  ok: false;
  error: TranslationKey;
  fieldErrors?: Record<string, TranslationKey>;
};
export type GuardianLogin =
  | { status: "created"; phone: string; password: string }
  | { status: "exists"; phone: string }
  | { status: "failed" };
export type ApproveResult =
  | { ok: true; studentCode: string; roll: number; login: GuardianLogin }
  | Failure;

async function admin(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin"]);
  return createClient();
}

/** Status, admission test and marks. An approved application is final. */
export async function saveReview(
  lang: string,
  id: number,
  input: unknown,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await admin(lang);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const testAt = v.test_at ? fromDhakaInput(v.test_at) : null;
  if (v.test_at && !testAt)
    return {
      ok: false,
      error: "errors.dateTime",
      fieldErrors: { test_at: "errors.dateTime" },
    };
  if (v.status === "test_scheduled" && !testAt)
    return {
      ok: false,
      error: "errors.required",
      fieldErrors: { test_at: "errors.required" },
    };

  const { data, error } = await supabase
    .from("admission_applications")
    .update({ ...v, test_at: testAt })
    .eq("id", id)
    .neq("status", "approved")
    .select("tracking_no");
  if (error) return dbError(error);
  if (!data.length) return { ok: false, error: "errors.alreadyApproved" };
  await supabase.rpc("record_audit", {
    p_action: "admission.reviewed",
    p_entity: "admission_application",
    p_entity_id: String(id),
    p_details: { status: v.status, test_at: testAt, test_marks: v.test_marks },
  });
  return { ok: true };
}

/**
 * Logs the guardian in with their mobile number: their account email is a placeholder
 * under the reserved .invalid domain (never delivered). One-time password, must change.
 */
async function guardianLogin(guardianId: number): Promise<GuardianLogin> {
  const service = createAdminClient();
  const { data: guardian } = await service
    .from("guardians")
    .select("id, profile_id, phone, full_name_en, full_name_bn, email")
    .eq("id", guardianId)
    .maybeSingle();
  if (!guardian) return { status: "failed" };
  if (guardian.profile_id) return { status: "exists", phone: guardian.phone };
  const { data: taken } = await service
    .from("profiles")
    .select("id, role")
    .eq("phone", guardian.phone)
    .maybeSingle();
  if (taken) {
    // Same mobile already logs in as a guardian (e.g. a brother's father record): reuse it.
    if (taken.role !== "guardian") return { status: "failed" };
    await service
      .from("guardians")
      .update({ profile_id: taken.id })
      .eq("id", guardian.id);
    return { status: "exists", phone: guardian.phone };
  }
  const password = tempPassword();
  const { data: created, error } = await service.auth.admin.createUser({
    email: `guardian-${guardian.phone}@guardian.invalid`,
    password,
    email_confirm: true,
  });
  if (error || !created.user) return { status: "failed" };
  const { error: profileError } = await service
    .from("profiles")
    .update({
      role: "guardian",
      phone: guardian.phone,
      full_name_en: guardian.full_name_en,
      full_name_bn: guardian.full_name_bn,
      must_change_password: true,
    })
    .eq("id", created.user.id);
  const { error: linkError } = profileError
    ? { error: profileError }
    : await service
        .from("guardians")
        .update({ profile_id: created.user.id })
        .eq("id", guardian.id)
        .is("profile_id", null);
  if (linkError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { status: "failed" };
  }
  return { status: "created", phone: guardian.phone, password };
}

/** Approves an application (one database transaction), then creates the guardian login. */
export async function approveApplication(
  lang: string,
  id: number,
  sectionId: number,
): Promise<ApproveResult> {
  assertId(id);
  assertId(sectionId);
  const supabase = await admin(lang);
  const { data, error } = await supabase
    .rpc("approve_admission", { p_application_id: id, p_section_id: sectionId })
    .single();
  if (error?.code === "23505")
    return { ok: false, error: "errors.alreadyApproved" };
  if (error?.code === "23514")
    return {
      ok: false,
      error: "errors.sectionClass",
      fieldErrors: { section_id: "errors.sectionClass" },
    };
  if (error || !data) return dbError(error) as Failure;
  const login = await guardianLogin(data.guardian_id);
  await supabase.rpc("record_audit", {
    p_action: `guardian.login.${login.status}`,
    p_entity: "guardian",
    p_entity_id: String(data.guardian_id),
    p_details: { application_id: id },
  });
  // Student counts on the home page.
  revalidateTag(TAGS.stats);
  return { ok: true, studentCode: data.student_code, roll: data.roll, login };
}

/** Tries the guardian login again for an approved application. */
export async function retryGuardianLogin(
  lang: string,
  id: number,
): Promise<{ ok: true; login: GuardianLogin } | Failure> {
  assertId(id);
  const supabase = await admin(lang);
  const { data: app } = await supabase
    .from("admission_applications")
    .select("student_id")
    .eq("id", id)
    .maybeSingle();
  if (!app?.student_id) return { ok: false, error: "errors.notAllowed" };
  const { data: link } = await supabase
    .from("student_guardians")
    .select("guardian_id")
    .eq("student_id", app.student_id)
    .eq("is_primary", true)
    .maybeSingle();
  if (!link) return { ok: false, error: "errors.notAllowed" };
  const login = await guardianLogin(link.guardian_id);
  await supabase.rpc("record_audit", {
    p_action: `guardian.login.${login.status}`,
    p_entity: "guardian",
    p_entity_id: String(link.guardian_id),
    p_details: { application_id: id },
  });
  return { ok: true, login };
}
