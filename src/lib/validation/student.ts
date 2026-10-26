import { z } from "zod";

import { isBirthRegNo, normalizeBirthRegNo } from "@/lib/admission";
import { toAsciiDigits } from "@/lib/format";
import { dhakaToday } from "@/lib/people";

import { BLOOD_GROUPS, GENDERS, RELIGIONS } from "./admission";
import { isBdPhone, normalizePhone } from "./auth";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const optionalDate = z.union([z.literal(""), z.iso.date("errors.date")]);
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(""), z.enum(values, "errors.required")]);
const id = z.number("errors.required").int().positive("errors.required");
const mobile = z
  .string()
  .trim()
  .transform((v) => (v ? normalizePhone(toAsciiDigits(v)) : ""))
  .refine((v) => v === "" || isBdPhone(v), "errors.mobile");
const requiredMobile = z
  .string()
  .trim()
  .min(1, "errors.required")
  .transform((v) => normalizePhone(toAsciiDigits(v)))
  .refine(isBdPhone, "errors.mobile");

export const STUDENT_STATUSES = [
  "active",
  "inactive",
  "transferred",
  "graduated",
] as const;
export const RELATIONS = ["father", "mother", "other"] as const;

/** A student's own record (the office form). */
export const studentSchema = z.object({
  full_name_en: required(100),
  full_name_bn: text(100),
  gender: z.enum(GENDERS, "errors.required"),
  religion: choice(RELIGIONS),
  blood_group: choice(BLOOD_GROUPS),
  status: z.enum(STUDENT_STATUSES, "errors.required"),
  admitted_on: optionalDate,
  birth_date: optionalDate.refine(
    (v) => v === "" || v < dhakaToday(),
    "errors.date",
  ),
  birth_reg_no: z
    .string()
    .trim()
    .refine((v) => v === "" || isBirthRegNo(v), "errors.birthRegNo")
    .transform((v) => (v ? normalizeBirthRegNo(v) : "")),
  address: text(300),
  personal_phone: mobile,
});
export type StudentInput = z.input<typeof studentSchema>;

const roll = z.coerce
  .number("errors.roll")
  .int("errors.roll")
  .min(1, "errors.roll")
  .max(999, "errors.roll");

/** Enrolment in a session: section, roll and (Classes 9-10) group. */
export const enrollmentSchema = z.object({
  session_id: id,
  section_id: id,
  roll,
  group_id: id.nullable(),
});

/** A new student is enrolled in the current session straight away; empty roll = next. */
export const newStudentSchema = studentSchema.extend({
  section_id: id,
  // The browser sends the parsed value, so null (from "") is accepted too.
  roll: z.union([z.literal("").transform(() => null), z.null(), roll]),
  group_id: id.nullable(),
});

/** Year-end promotion of one class. */
export const promotionSchema = z
  .object({
    from_session: id,
    to_session: id,
    class_id: id,
    decisions: z
      .array(z.object({ student_id: id, promote: z.boolean() }))
      .min(1, "promotion.empty")
      .max(2000),
  })
  .refine((v) => v.from_session !== v.to_session, {
    message: "promotion.sameSession",
    path: ["to_session"],
  });

/** Link an existing guardian (by id) or a new one, with the relation. */
export const guardianLinkSchema = z
  .object({
    guardian_id: id.nullable(),
    full_name_en: text(100),
    full_name_bn: text(100),
    phone: mobile,
    occupation: text(100),
    relation: z.enum(RELATIONS, "errors.required"),
    is_primary: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.guardian_id !== null) return;
    if (!v.full_name_en)
      ctx.addIssue({
        code: "custom",
        path: ["full_name_en"],
        message: "errors.required",
      });
    if (!v.phone)
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "errors.required",
      });
  });

/** Converts the DB row into form values (empty strings for missing values). */
export function studentFormValues(
  row: Record<string, unknown> | null,
): StudentInput {
  const r = row ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    full_name_en: s(r.full_name_en),
    full_name_bn: s(r.full_name_bn),
    gender: (s(r.gender) || "") as StudentInput["gender"],
    religion: s(r.religion) as StudentInput["religion"],
    blood_group: s(r.blood_group) as StudentInput["blood_group"],
    status: (s(r.status) || "active") as StudentInput["status"],
    admitted_on: s(r.admitted_on),
    birth_date: s(r.birth_date),
    birth_reg_no: s(r.birth_reg_no),
    address: s(r.address),
    personal_phone: s(r.personal_phone),
  };
}

export { requiredMobile };
