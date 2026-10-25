import { z } from "zod";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const isoDate = z.iso.date("errors.date");
const id = z.number("errors.required").int().positive("errors.required");
/** A whole number typed in a form (the input gives a string). */
const wholeNumber = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

export const sessionSchema = z
  .object({
    name: required(30),
    starts_on: isoDate,
    ends_on: isoDate,
  })
  .refine((v) => v.ends_on > v.starts_on, {
    message: "errors.endBeforeStart",
    path: ["ends_on"],
  });

export const classSchema = z.object({
  level: wholeNumber(6, 10, "errors.classLevel"),
  name_en: required(50),
  name_bn: text(50),
});

export const groupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "errors.required")
    .max(30, "errors.tooLong")
    .regex(/^[a-z_]+$/, "errors.groupCode"),
  name_en: required(50),
  name_bn: text(50),
});

export const sectionSchema = z.object({
  class_id: id,
  name_en: required(20),
  name_bn: text(20),
  /** Empty means no limit. */
  capacity: z.union([
    z.literal("").transform(() => null),
    z.null(),
    wholeNumber(1, 200, "errors.capacity"),
  ]),
  class_teacher_id: id.nullable(),
});

export const SUBJECT_TYPES = ["compulsory", "optional", "fourth"] as const;

export const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, "errors.subjectCode")),
  name_en: required(80),
  name_bn: text(80),
  type: z.enum(SUBJECT_TYPES),
  sort_order: wholeNumber(0, 999, "errors.digits"),
});

/** The subjects taught in one class (and group, for Classes 9 and 10). */
export const classSubjectsSchema = z.object({
  class_id: id,
  group_id: id.nullable(),
  subject_ids: z
    .array(id)
    .max(50, "errors.tooLong")
    .refine((ids) => new Set(ids).size === ids.length, "errors.duplicate"),
});

/** Groups (Science, Business Studies, Humanities) apply from Class 9. */
export const classUsesGroups = (level: number) => level >= 9;

export type SessionInput = z.input<typeof sessionSchema>;
export type ClassInput = z.input<typeof classSchema>;
export type GroupInput = z.input<typeof groupSchema>;
export type SectionInput = z.input<typeof sectionSchema>;
export type SubjectInput = z.input<typeof subjectSchema>;
