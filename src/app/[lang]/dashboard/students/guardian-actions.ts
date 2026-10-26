"use server";

import { z } from "zod";

import { pickLocalized, toAsciiDigits } from "@/lib/format";
import { isLocale } from "@/i18n/config";
import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { assertId } from "@/lib/validation/ids";
import { isBdPhone, normalizePhone } from "@/lib/validation/auth";
import { guardianLinkSchema } from "@/lib/validation/student";

export type GuardianMatch = { id: number; name: string; children: string[] };

/** Guardians who already have this mobile number, with their children (brothers, sisters). */
export async function findGuardians(
  lang: string,
  phoneInput: unknown,
): Promise<GuardianMatch[]> {
  const supabase = await requireAdmin(lang);
  const phone = normalizePhone(
    toAsciiDigits(z.string().max(20).parse(phoneInput)),
  );
  if (!isBdPhone(phone) || !isLocale(lang)) return [];
  const { data } = await supabase
    .from("guardians")
    .select(
      "id, full_name_en, full_name_bn, student_guardians(student:students(full_name_en, full_name_bn))",
    )
    .eq("phone", phone)
    .limit(10);
  return (data ?? []).map((g) => ({
    id: g.id,
    name: pickLocalized(g, "full_name", lang),
    children: g.student_guardians.map((sg) =>
      pickLocalized(
        sg.student as unknown as { full_name_en: string; full_name_bn: string },
        "full_name",
        lang,
      ),
    ),
  }));
}

/** Makes one guardian the student's main contact, in one database step. */
async function makePrimary(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  studentId: number,
  guardianId: number,
) {
  const { data, error } = await supabase.rpc("set_primary_guardian", {
    p_student_id: studentId,
    p_guardian_id: guardianId,
  });
  if (error) return error;
  return data === true ? null : { code: "P0002" };
}

/** Links an existing guardian, or a new one, to the student. */
export async function linkGuardian(
  lang: string,
  studentId: number,
  input: unknown,
): Promise<ActionResult> {
  assertId(studentId);
  const supabase = await requireAdmin(lang);
  const parsed = guardianLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  let guardianId = v.guardian_id;
  if (guardianId === null) {
    const { data, error } = await supabase
      .from("guardians")
      .insert({
        full_name_en: v.full_name_en,
        full_name_bn: v.full_name_bn,
        phone: v.phone,
        occupation: v.occupation,
      })
      .select("id")
      .single();
    if (error) return dbError(error);
    guardianId = data.id;
  }
  const { count } = await supabase
    .from("student_guardians")
    .select("guardian_id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("is_primary", true);
  const { error } = await supabase.from("student_guardians").insert({
    student_id: studentId,
    guardian_id: guardianId,
    relation: v.relation,
    is_primary: false,
  });
  if (error) {
    // Do not leave a new guardian behind that belongs to nobody.
    if (v.guardian_id === null)
      await supabase.from("guardians").delete().eq("id", guardianId);
    return dbError(error, "guardian_id");
  }
  if (v.is_primary || !count) {
    const primaryError = await makePrimary(supabase, studentId, guardianId);
    if (primaryError) return dbError(primaryError);
  }
  return { ok: true, id: guardianId };
}

export async function unlinkGuardian(
  lang: string,
  studentId: number,
  guardianId: number,
): Promise<ActionResult> {
  assertId(studentId);
  assertId(guardianId);
  const supabase = await requireAdmin(lang);
  const { data, error } = await supabase
    .from("student_guardians")
    .delete()
    .eq("student_id", studentId)
    .eq("guardian_id", guardianId)
    .select("is_primary");
  if (error) return dbError(error);
  const [row] = data;
  if (!row) return { ok: false, error: "errors.notAllowed" };
  // Someone else becomes the main contact.
  if (row.is_primary) {
    const { data: next } = await supabase
      .from("student_guardians")
      .select("guardian_id")
      .eq("student_id", studentId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (next) await makePrimary(supabase, studentId, next.guardian_id);
  }
  return { ok: true };
}

export async function setPrimaryGuardian(
  lang: string,
  studentId: number,
  guardianId: number,
): Promise<ActionResult> {
  assertId(studentId);
  assertId(guardianId);
  const supabase = await requireAdmin(lang);
  const error = await makePrimary(supabase, studentId, guardianId);
  if (error?.code === "P0002") return { ok: false, error: "errors.notAllowed" };
  return error ? dbError(error) : { ok: true };
}
