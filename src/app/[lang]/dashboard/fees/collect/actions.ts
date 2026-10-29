"use server";

import { revalidatePath } from "next/cache";

import {
  dbError,
  invalid,
  requireAdmin,
  requireFeeStaff,
  type ActionResult,
} from "@/lib/actions";
import { cancelSchema, paymentSchema } from "@/lib/validation/collection";

/** Records a payment; returns the payment id for the receipt. */
export async function recordPayment(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const { db } = await requireFeeStaff(lang);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { data, error } = await db.rpc("record_payment", {
    p_student_id: v.student_id,
    p_item_ids: v.item_ids,
    p_amount: v.amount,
    p_method: v.method,
    p_txn_id: v.txn_id ?? "",
    p_note: v.note,
  });
  if (error?.code === "23514")
    return {
      ok: false,
      error: "fees.collect.errors.over",
      fieldErrors: { amount: "fees.collect.errors.over" },
    };
  if (error?.code === "23505")
    return {
      ok: false,
      error: "fees.collect.errors.txnUsed",
      fieldErrors: { txn_id: "fees.collect.errors.txnUsed" },
    };
  if (error?.code === "22023")
    return { ok: false, error: "fees.collect.errors.changed" };
  if (error || !data) return dbError(error);
  revalidatePath(`/${lang}/dashboard`, "layout");
  return { ok: true, id: (data as { payment_id: number }).payment_id };
}

/** Cancels a payment (admins): the receipt stays, marked cancelled. */
export async function cancelPayment(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const db = await requireAdmin(lang);
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await db.rpc("cancel_payment", {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });
  if (error?.code === "22023")
    return { ok: false, error: "fees.receipt.errors.alreadyCancelled" };
  if (error) return dbError(error);
  revalidatePath(`/${lang}/dashboard`, "layout");
  return { ok: true };
}
