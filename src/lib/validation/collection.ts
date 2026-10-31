import { z } from "zod";

import { needsTxn, PAYMENT_METHODS, readTxn } from "@/lib/collection";
import { toPoisha } from "@/lib/fees";

const id = z.number().int().positive();

/** A payment as the collect form sends it; amount in taka. */
export const paymentSchema = z
  .object({
    student_id: id,
    item_ids: z.array(id).min(1, "fees.collect.errors.noItems").max(500),
    amount: z.union([z.string(), z.number()]).transform((v, ctx) => {
      const p = toPoisha(String(v));
      if (p === null || p === 0) {
        ctx.addIssue({ code: "custom", message: "errors.money" });
        return z.NEVER;
      }
      return p;
    }),
    method: z.enum(PAYMENT_METHODS),
    txn_id: z.string().max(60, "errors.tooLong").default(""),
    note: z.string().trim().max(300, "errors.tooLong").default(""),
    /** What the screen showed as owed (poisha): the server refuses if the bills changed. */
    expected: z.number().int().min(0).max(1e12).optional(),
  })
  .transform((v, ctx) => {
    const txn = v.txn_id.trim() ? readTxn(v.txn_id) : null;
    if (v.txn_id.trim() && !txn) {
      ctx.addIssue({
        code: "custom",
        path: ["txn_id"],
        message: "fees.collect.errors.txn",
      });
      return z.NEVER;
    }
    if (needsTxn(v.method) && !txn) {
      ctx.addIssue({
        code: "custom",
        path: ["txn_id"],
        message: "fees.collect.errors.txnNeeded",
      });
      return z.NEVER;
    }
    return { ...v, txn_id: txn };
  });
export type PaymentInput = z.input<typeof paymentSchema>;

export const cancelReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "fees.receipt.errors.reason")
    .max(300, "errors.tooLong"),
});
export const cancelSchema = cancelReasonSchema.extend({ id });
