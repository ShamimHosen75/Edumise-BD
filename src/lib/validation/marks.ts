import { z } from "zod";

const id = z.number().int().positive();
const mark = z.number().min(0).max(999).nullable();

/** A batch of marks for one exam subject and section (autosave or import). */
export const marksSaveSchema = z.object({
  exam_subject_id: id,
  section_id: id,
  rows: z
    .array(
      z.object({
        student_id: id,
        cq: mark,
        mcq: mark,
        practical: mark,
        is_absent: z.boolean(),
      }),
    )
    .min(1)
    .max(300),
});

export const EXAM_STATUSES = [
  "draft",
  "marks_entry",
  "review",
  "published",
] as const;

const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const isoDate = z.iso.date("errors.date");

/** An exam: names, dates and the classes that sit it. */
export const examSchema = z
  .object({
    name_en: text(100).min(1, "errors.required"),
    name_bn: text(100),
    starts_on: z.union([z.literal(""), isoDate]),
    ends_on: z.union([z.literal(""), isoDate]),
    class_ids: z.array(id).min(1, "errors.examClasses").max(10),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, {
    message: "errors.endBeforeStart",
    path: ["ends_on"],
  });

const whole = (message: string) =>
  z.coerce.number(message).int(message).min(0, message).max(200, message);
const optionalPass = z.union([
  z.literal("").transform(() => null),
  z.null(),
  whole("errors.passMarks"),
]);

/** Full and pass marks of one subject in one class for an exam. */
export const examSubjectSchema = z
  .object({
    exam_id: id,
    class_id: id,
    subject_id: id,
    cq_full: whole("errors.fullMarks"),
    cq_pass: optionalPass,
    mcq_full: whole("errors.fullMarks"),
    mcq_pass: optionalPass,
    practical_full: whole("errors.fullMarks"),
    practical_pass: optionalPass,
    counts_in_gpa: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.cq_full + v.mcq_full + v.practical_full === 0)
      ctx.addIssue({
        code: "custom",
        path: ["cq_full"],
        message: "errors.fullMarks",
      });
    for (const p of ["cq", "mcq", "practical"] as const) {
      const pass = v[`${p}_pass`];
      if (pass !== null && pass > v[`${p}_full`])
        ctx.addIssue({
          code: "custom",
          path: [`${p}_pass`],
          message: "errors.passMarks",
        });
    }
  });
