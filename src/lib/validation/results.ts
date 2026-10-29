import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

const id = z.number().int().positive();
const mark = z.number().min(0).max(999).nullable();
const gpa = z.number().min(0).max(5);

/** One paper as printed on the mark sheet. */
export const paperSnapshotSchema = z.object({
  name_en: z.string(),
  name_bn: z.string(),
  full: z.number().int().min(0),
  cq: mark,
  mcq: mark,
  practical: mark,
  absent: z.boolean(),
});

/** One graded subject, saved with the result (results.subjects). */
export const subjectSnapshotSchema = z.object({
  key: z.string().min(1).max(40),
  name_en: z.string(),
  name_bn: z.string(),
  role: z.enum(["compulsory", "fourth", "extra"]),
  papers: z.array(paperSnapshotSchema).min(1).max(4),
  obtained: z.number().min(0),
  full: z.number().int().min(0),
  percent: z.number().min(0).max(100),
  grade: z.string().min(1).max(3),
  point: gpa,
  failed: z.boolean(),
  absent: z.boolean(),
  failed_parts: z.array(z.enum(["cq", "mcq", "practical"])),
});
export type SubjectSnapshot = z.infer<typeof subjectSnapshotSchema>;

/** A result row as sent to save_exam_results(). */
export const resultRowSchema = z.object({
  student_id: id,
  total: z.number().min(0),
  full_total: z.number().int().min(0),
  gpa,
  gpa_without_fourth: gpa,
  grade: z.string().min(1).max(3),
  passed: z.boolean(),
  failed_count: z.number().int().min(0),
  section_position: id,
  class_position: id,
  attendance_percent: z.number().min(0).max(100).nullable(),
  subjects: z.array(subjectSnapshotSchema).min(1).max(30),
});
export type ResultRow = z.infer<typeof resultRowSchema>;

export const resultRowsSchema = z.array(resultRowSchema).max(5000);

const wanted = (message: string) =>
  z.coerce.number(message).int(message).positive(message);

/** The public result search form. */
export const resultSearchSchema = z.object({
  exam: wanted("result.errors.exam"),
  section: wanted("result.errors.section"),
  roll: z.preprocess(
    (v) => (typeof v === "string" ? toAsciiDigits(v).trim() : v),
    z.coerce
      .number("result.errors.roll")
      .int("result.errors.roll")
      .min(1, "result.errors.roll")
      .max(999, "result.errors.roll"),
  ),
  group: z.union([
    z.literal("").transform(() => null),
    wanted("result.errors.group"),
  ]),
});

const count = (message: string) =>
  z.coerce.number(message).int(message).min(0, message).max(100000, message);

/** One year of board exam results (WEB-11). */
export const boardResultSchema = z
  .object({
    exam: z.enum(["ssc", "jsc"]),
    year: z.coerce
      .number("errors.year")
      .int("errors.year")
      .min(1950, "errors.year")
      .max(2100, "errors.year"),
    examinees: count("errors.count").refine((v) => v > 0, "errors.count"),
    passed: count("errors.count"),
    gpa5: count("errors.count"),
  })
  .refine((v) => v.passed <= v.examinees, {
    message: "boardResults.errors.passed",
    path: ["passed"],
  })
  .refine((v) => v.gpa5 <= v.passed, {
    message: "boardResults.errors.gpa5",
    path: ["gpa5"],
  });
