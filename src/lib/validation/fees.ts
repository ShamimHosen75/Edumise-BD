import { z } from "zod";

import { FEE_FREQUENCIES, toPoisha } from "@/lib/fees";
import { toAsciiDigits } from "@/lib/format";

const id = z.number().int().positive();
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");

/** Taka typed in a form ("1,200.50", Bangla digits) -> poisha. */
const money = (message = "errors.money") =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const p = toPoisha(String(v));
    if (p === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return p;
  });

const whole = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? toAsciiDigits(v).trim() : v),
    z.coerce.number(message).int(message).min(min, message).max(max, message),
  );

export const feeHeadSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9_]{2,20}$/, "errors.feeCode")),
  name_en: text(80).min(1, "errors.required"),
  name_bn: text(80),
  frequency: z.enum(FEE_FREQUENCIES),
  sort_order: whole(0, 999, "errors.digits"),
});

/** The structure grid: one cell per class (+ group) and head; "" removes the amount. */
export const structureSchema = z.object({
  session_id: id,
  cells: z
    .array(
      z.object({
        class_id: id,
        group_id: id.nullable(),
        fee_head_id: id,
        amount: z.union([z.literal("").transform(() => null), money()]),
      }),
    )
    .max(2000),
});

export const WAIVER_KINDS = ["percent", "fixed"] as const;

/** A waiver for one student and head in the current session. */
export const waiverSchema = z
  .object({
    student_code: z
      .string()
      .transform((v) => toAsciiDigits(v).trim())
      .pipe(z.string().regex(/^\d{10}$/, "errors.studentCode")),
    fee_head_id: z.coerce
      .number("errors.required")
      .int()
      .positive("errors.required"),
    kind: z.enum(WAIVER_KINDS),
    // Text from the form, or the number when the form already checked it.
    value: z.union([z.string(), z.number()]).transform(String),
    reason: text(200).min(1, "errors.required"),
  })
  .transform((v, ctx) => {
    const raw = toAsciiDigits(v.value).trim();
    const value =
      v.kind === "percent"
        ? /^\d{1,3}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 100
          ? Number(raw)
          : null
        : toPoisha(raw);
    if (value === null || value <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: v.kind === "percent" ? "errors.percent" : "errors.money",
      });
      return z.NEVER;
    }
    return { ...v, value };
  });

/** The invoice generator: a month (monthly heads) or a one-time head (+ exam). */
export const generateSchema = z
  .object({
    session_id: id,
    kind: z.enum(["monthly", "one_time"]),
    month: z.string().optional(),
    fee_head_id: id.nullable().optional(),
    exam_id: id.nullable().optional(),
    class_ids: z.array(id).min(1, "errors.feeClasses").max(10),
    due_on: z.iso.date("errors.date"),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "monthly" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month ?? ""))
      ctx.addIssue({
        code: "custom",
        path: ["month"],
        message: "errors.month",
      });
    if (v.kind === "one_time" && !v.fee_head_id)
      ctx.addIssue({
        code: "custom",
        path: ["fee_head_id"],
        message: "errors.required",
      });
  });
export type GenerateInput = z.infer<typeof generateSchema>;

// The database allows at most Tk 10,00,000 (100,000,000 poisha) for each.
const fineMoney = () =>
  money().pipe(z.number().max(100_000_000, "errors.moneyTooLarge"));

export const fineSettingsSchema = z.object({
  late_fine_per_day: fineMoney(),
  late_fine_cap: fineMoney(),
  grace_days: whole(0, 60, "errors.graceDays"),
  due_days: whole(0, 90, "errors.dueDays"),
});
