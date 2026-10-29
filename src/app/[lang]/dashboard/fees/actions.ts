"use server";

import {
  dbError,
  invalid,
  requireFeeStaff,
  type ActionResult,
} from "@/lib/actions";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import {
  feeHeadSchema,
  fineSettingsSchema,
  structureSchema,
  waiverSchema,
} from "@/lib/validation/fees";

// Fee setup for the office and the accountant. RLS allows the same roles.

export async function saveFeeHead(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  const { db } = await requireFeeStaff(lang);
  const parsed = feeHeadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== null) {
    // Billed periods depend on monthly vs one-time: no switch once invoiced.
    const { data: head } = await db
      .from("fee_heads")
      .select("frequency")
      .eq("id", id)
      .maybeSingle();
    if (!head) return { ok: false, error: "errors.notAllowed" };
    if (head.frequency !== parsed.data.frequency) {
      const { count } = await db
        .from("invoice_items")
        .select("id", { count: "exact", head: true })
        .eq("fee_head_id", id);
      if (count)
        return {
          ok: false,
          error: "errors.inUse",
          fieldErrors: { frequency: "errors.inUse" },
        };
    }
  }
  const { data, error } =
    id === null
      ? await db.from("fee_heads").insert(parsed.data).select("id").single()
      : await db
          .from("fee_heads")
          .update(parsed.data)
          .eq("id", id)
          .select("id")
          .maybeSingle();
  if (error) return dbError(error, "code");
  if (!data) return { ok: false, error: "errors.notAllowed" };
  return { ok: true, id: data.id };
}

export async function deleteFeeHead(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const { db } = await requireFeeStaff(lang);
  const { data, error } = await db
    .from("fee_heads")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  return data.length ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}

/** Saves the structure grid of a session: amounts set or changed, empty cells removed. */
export async function saveStructure(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const { db } = await requireFeeStaff(lang);
  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { session_id, cells } = parsed.data;
  const set = cells.filter((c) => c.amount !== null);
  if (set.length) {
    const { error } = await db.from("fee_structures").upsert(
      set.map((c) => ({
        session_id,
        class_id: c.class_id,
        group_id: c.group_id,
        fee_head_id: c.fee_head_id,
        amount: c.amount!,
      })),
      { onConflict: "session_id,class_id,group_id,fee_head_id" },
    );
    if (error) return dbError(error);
  }
  for (const c of cells.filter((x) => x.amount === null)) {
    let q = db
      .from("fee_structures")
      .delete()
      .eq("session_id", session_id)
      .eq("class_id", c.class_id)
      .eq("fee_head_id", c.fee_head_id);
    q =
      c.group_id === null
        ? q.is("group_id", null)
        : q.eq("group_id", c.group_id);
    const { error } = await q;
    if (error) return dbError(error);
  }
  return { ok: true };
}

export async function copyStructure(
  lang: string,
  fromId: number,
  toId: number,
): Promise<ActionResult & { copied?: number }> {
  assertId(fromId);
  assertId(toId);
  const { db } = await requireFeeStaff(lang);
  const { data, error } = await db.rpc("copy_fee_structure", {
    p_from: fromId,
    p_to: toId,
  });
  if (error) return dbError(error);
  return { ok: true, copied: data };
}

/** Adds or changes a waiver in the current session (an admin's save approves it). */
export async function saveWaiver(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  const { db } = await requireFeeStaff(lang);
  const parsed = waiverSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const [{ data: student }, { data: session }] = await Promise.all([
    db
      .from("students")
      .select("id")
      .eq("student_code", v.student_code)
      .maybeSingle(),
    db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .maybeSingle(),
  ]);
  if (!student)
    return {
      ok: false,
      error: "certificates.notFound",
      fieldErrors: { student_code: "certificates.notFound" },
    };
  if (!session) return { ok: false, error: "errors.notAllowed" };
  const row = {
    student_id: student.id,
    session_id: session.id,
    fee_head_id: v.fee_head_id,
    kind: v.kind,
    value: v.value,
    reason: v.reason,
  };
  const { data, error } =
    id === null
      ? await db.from("fee_waivers").insert(row).select("id").single()
      : await db
          .from("fee_waivers")
          .update(row)
          .eq("id", id)
          .select("id")
          .maybeSingle();
  if (error) return dbError(error);
  if (!data) return { ok: false, error: "errors.notAllowed" };
  return { ok: true, id: data.id };
}

export async function deleteWaiver(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const { db } = await requireFeeStaff(lang);
  const { data, error } = await db
    .from("fee_waivers")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  return data.length ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}

/** An admin approves a waiver (the database stamps who and when). */
export async function approveWaiver(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const { db, me } = await requireFeeStaff(lang);
  if (me.role !== "admin" && me.role !== "super_admin")
    return { ok: false, error: "errors.notAllowed" };
  const { data, error } = await db
    .from("fee_waivers")
    .update({ approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  return data.length ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}

export async function saveFineSettings(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const { db } = await requireFeeStaff(lang);
  const parsed = fineSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data, error } = await db
    .from("fee_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return dbError(error);
  return data.length ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}
