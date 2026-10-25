import { z } from "zod";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const id = z.number("errors.required").int().positive("errors.required");
const isoDate = z.iso.date("errors.date");
/** A time from <input type="time"> ("08:00") or the database ("08:00:00"). */
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
/** End after start; skipped when a time is itself wrong (that has its own message). */
const endsAfter = (v: { starts_at: string; ends_at: string }) =>
  !TIME.test(v.starts_at.slice(0, 5)) ||
  !TIME.test(v.ends_at.slice(0, 5)) ||
  v.ends_at > v.starts_at;
const time = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/, "errors.time")
  .transform((v) => v.slice(0, 5));

export const periodSchema = z
  .object({
    number: z.coerce
      .number("errors.digits")
      .int("errors.digits")
      .min(1, "errors.digits")
      .max(20, "errors.digits"),
    starts_at: time,
    ends_at: time,
    is_break: z.boolean(),
  })
  .refine(endsAfter, {
    message: "errors.endBeforeStart",
    path: ["ends_at"],
  });

export const roomSchema = z.object({ name: required(60) });

export const holidaySchema = z
  .object({
    title_en: required(120),
    title_bn: text(120),
    starts_on: isoDate,
    ends_on: isoDate,
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    message: "errors.endBeforeStart",
    path: ["ends_on"],
  });

export const examScheduleSchema = z
  .object({
    exam_id: id,
    class_id: id,
    subject_id: id,
    exam_date: isoDate,
    starts_at: time,
    ends_at: time,
  })
  .refine(endsAfter, {
    message: "errors.endBeforeStart",
    path: ["ends_at"],
  });

export const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "errors.workingDays")
  .max(7)
  .refine((d) => new Set(d).size === d.length, "errors.duplicate");

export const routineSaveSchema = z.object({
  session_id: id,
  section_id: id,
  cells: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        periodId: id,
        subjectId: id,
        staffId: id.nullable(),
        roomId: id.nullable(),
      }),
    )
    .max(100),
});
