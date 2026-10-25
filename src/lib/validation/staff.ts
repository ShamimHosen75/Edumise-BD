import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

import { isBdPhone, normalizePhone } from "./auth";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const optionalDate = z.union([z.literal(""), z.iso.date("errors.date")]);
const id = z.number("errors.required").int().positive("errors.required");
const wholeNumber = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

/** Public profile and private details of one member of staff, edited together. */
export const staffSchema = z
  .object({
    full_name_en: required(100),
    full_name_bn: text(100),
    designation_id: id,
    subject_en: text(80),
    subject_bn: text(80),
    qualification_en: text(200),
    qualification_bn: text(200),
    bio_en: text(1000),
    bio_bn: text(1000),
    joined_on: optionalDate,
    left_on: optionalDate,
    is_public: z.boolean(),
    sort_order: wholeNumber(0, 999, "errors.digits"),
    // Private: never shown on public pages.
    nid: z
      .string()
      .trim()
      .transform(toAsciiDigits)
      .refine(
        (v) => v === "" || /^(\d{10}|\d{13}|\d{17})$/.test(v),
        "errors.nid",
      ),
    birth_date: optionalDate.refine(
      (v) => v === "" || v < new Date().toISOString().slice(0, 10),
      "errors.date",
    ),
    address: text(300),
    personal_phone: z
      .string()
      .trim()
      .transform((v) => (v ? normalizePhone(toAsciiDigits(v)) : ""))
      .refine((v) => v === "" || isBdPhone(v), "errors.mobile"),
    email: z
      .string()
      .trim()
      .pipe(
        z.union([
          z.literal(""),
          z.email("errors.email").max(200, "errors.tooLong"),
        ]),
      ),
  })
  .refine((v) => !v.left_on || !v.joined_on || v.left_on >= v.joined_on, {
    message: "errors.endBeforeStart",
    path: ["left_on"],
  });

export type StaffInput = z.input<typeof staffSchema>;
export type StaffValues = z.output<typeof staffSchema>;

/** Roles a staff login can have. Only a super admin may give the admin role. */
export const STAFF_ROLES = ["teacher", "accountant", "admin"] as const;

export const staffLoginSchema = z.object({
  // Trim first: pasted addresses often carry spaces.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("errors.email").max(200, "errors.tooLong")),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizePhone(toAsciiDigits(v)) : ""))
    .refine((v) => v === "" || isBdPhone(v), "errors.mobile"),
  role: z.enum(STAFF_ROLES, "errors.required"),
});

export const assignmentSchema = z.object({
  session_id: id,
  section_id: id,
  subject_id: id,
});

export const designationSchema = z.object({
  rank: wholeNumber(1, 99, "errors.rank"),
  name_en: required(60),
  name_bn: text(60),
  is_teaching: z.boolean(),
});

/** Splits validated form values into the staff row and the private row. */
export function splitStaff(v: StaffValues) {
  const { nid, birth_date, address, personal_phone, email, ...pub } = v;
  return {
    staff: {
      ...pub,
      joined_on: pub.joined_on || null,
      left_on: pub.left_on || null,
    },
    private: {
      nid: nid || null,
      birth_date: birth_date || null,
      address: address || null,
      personal_phone: personal_phone || null,
      email: email || null,
    },
  };
}

type Row = Record<string, unknown> | null | undefined;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Database rows (or nothing, for new staff) -> form values. */
export function staffFormValues(staff: Row, priv: Row): StaffInput {
  const s = staff ?? {};
  const p = priv ?? {};
  return {
    full_name_en: str(s.full_name_en),
    full_name_bn: str(s.full_name_bn),
    designation_id:
      typeof s.designation_id === "number"
        ? s.designation_id
        : (null as unknown as number),
    subject_en: str(s.subject_en),
    subject_bn: str(s.subject_bn),
    qualification_en: str(s.qualification_en),
    qualification_bn: str(s.qualification_bn),
    bio_en: str(s.bio_en),
    bio_bn: str(s.bio_bn),
    joined_on: str(s.joined_on),
    left_on: str(s.left_on),
    is_public: staff ? s.is_public === true : true,
    sort_order: typeof s.sort_order === "number" ? s.sort_order : 0,
    nid: str(p.nid),
    birth_date: str(p.birth_date),
    address: str(p.address),
    personal_phone: str(p.personal_phone),
    email: str(p.email),
  };
}
