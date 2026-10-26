import { z } from "zod";

import { dhakaToday } from "@/lib/people";

import { ageOn, isBirthRegNo, normalizeBirthRegNo } from "@/lib/admission";
import { toAsciiDigits } from "@/lib/format";

import { isBdPhone, normalizePhone } from "./auth";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(""), z.enum(values, "errors.required")]);

export const GENDERS = ["male", "female", "other"] as const;
export const RELIGIONS = [
  "islam",
  "hinduism",
  "buddhism",
  "christianity",
  "other",
] as const;
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export const ADMISSION_STATUSES = [
  "submitted",
  "under_review",
  "test_scheduled",
  "approved",
  "rejected",
  "waitlisted",
] as const;

const today = () => dhakaToday();

/** Step 1: the student. Age 8 to 20 (Classes 6 to 10, with room for late starters). */
export const studentStep = z.object({
  student_name_en: required(100),
  student_name_bn: text(100),
  birth_date: z.iso
    .date("errors.date")
    .refine((v) => v < today(), "errors.date")
    .refine((v) => {
      const age = ageOn(v, today());
      return age >= 8 && age <= 20;
    }, "errors.studentAge"),
  gender: z.enum(GENDERS, "errors.required"),
  birth_reg_no: z
    .string()
    .trim()
    .refine(isBirthRegNo, "errors.birthRegNo")
    .transform(normalizeBirthRegNo),
  religion: choice(RELIGIONS),
  blood_group: choice(BLOOD_GROUPS),
});

/** Step 2: parents and the contact for the application. */
export const guardianStep = z.object({
  father_name: required(100),
  mother_name: required(100),
  local_guardian_name: text(100),
  guardian_phone: z
    .string()
    .trim()
    .min(1, "errors.required")
    .transform((v) => normalizePhone(toAsciiDigits(v)))
    .refine(isBdPhone, "errors.mobile"),
  guardian_occupation: text(100),
  guardian_email: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(""),
        z.email("errors.email").max(200, "errors.tooLong"),
      ]),
    ),
  present_address: required(300),
  permanent_address: text(300),
});

/** Step 3: class (and group for Classes 9 and 10), previous school. */
export const academicStep = z.object({
  class_id: z.number("errors.required").int().positive("errors.required"),
  group_id: z.number().int().positive().nullable(),
  previous_school: text(150),
  last_result: text(50),
});

/** Step 5: the declaration must be ticked. */
export const declarationStep = z.object({
  declaration: z.literal(true, "errors.declaration"),
});

export const applicationSchema = studentStep
  .extend(guardianStep.shape)
  .extend(academicStep.shape)
  .extend(declarationStep.shape)
  // A honeypot: people never see or fill it.
  .extend({ website: z.string().max(200).optional() });

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationValues = z.output<typeof applicationSchema>;

export const statusLookupSchema = z.object({
  tracking_no: z
    .string()
    .trim()
    .min(1, "errors.required")
    .max(30, "errors.tooLong"),
  phone: z
    .string()
    .trim()
    .min(1, "errors.required")
    .transform((v) => normalizePhone(toAsciiDigits(v)))
    .refine(isBdPhone, "errors.mobile"),
});

/** Office review: status, test schedule and marks. */
export const reviewSchema = z.object({
  status: z.enum(
    ["submitted", "under_review", "test_scheduled", "rejected", "waitlisted"],
    "errors.required",
  ),
  test_at: z.string().trim(),
  test_venue: text(150),
  test_marks: z.union([
    z.literal("").transform(() => null),
    z.null(),
    z.coerce
      .number("errors.marks")
      .min(0, "errors.marks")
      .max(100, "errors.marks")
      // At most two decimals. 72.1 * 100 is 7209.999… in floating point, so compare
      // with a small tolerance instead of exactly.
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
        "errors.marks",
      ),
  ]),
  office_note: text(500),
});

/** Limits: photo 500 KB (JPG/PNG), documents 2 MB (PDF/JPG). */
export const PHOTO_MAX_BYTES = 500 * 1024;
export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const APPLY_LIMIT = { max: 10, windowSeconds: 60 * 60 } as const;
export const STATUS_LIMIT = { max: 30, windowSeconds: 60 * 60 } as const;
