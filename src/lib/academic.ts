import {
  classSchema,
  groupSchema,
  sectionSchema,
  sessionSchema,
  subjectSchema,
} from "@/lib/validation/academic";
import {
  examScheduleSchema,
  holidaySchema,
  periodSchema,
  roomSchema,
} from "@/lib/validation/routine";
import { examSubjectSchema } from "@/lib/validation/marks";
import { designationSchema } from "@/lib/validation/staff";

/** The academic setup lists an admin edits, each with its table, schema and unique field. */
export const ACADEMIC = {
  sessions: {
    table: "academic_sessions",
    schema: sessionSchema,
    unique: "name",
  },
  classes: { table: "classes", schema: classSchema, unique: "level" },
  sections: { table: "sections", schema: sectionSchema, unique: "name_en" },
  groups: { table: "groups", schema: groupSchema, unique: "code" },
  subjects: { table: "subjects", schema: subjectSchema, unique: "code" },
  // Staff designations (Head Teacher, ...) use the same table and dialog pattern.
  designations: {
    table: "designations",
    schema: designationSchema,
    unique: "rank",
  },
  // Step 3.5: routine and calendar lists.
  periods: { table: "periods", schema: periodSchema, unique: "number" },
  rooms: { table: "rooms", schema: roomSchema, unique: "name" },
  holidays: { table: "holidays", schema: holidaySchema, unique: "title_en" },
  "exam-subjects": {
    table: "exam_subjects",
    schema: examSubjectSchema,
    unique: "subject_id",
  },
  "exam-schedule": {
    table: "exam_schedule",
    schema: examScheduleSchema,
    unique: "subject_id",
  },
} as const;

export type AcademicEntity = keyof typeof ACADEMIC;

export const isAcademicEntity = (v: string): v is AcademicEntity =>
  Object.hasOwn(ACADEMIC, v);

/** Dashboard pages of the academic setup, in menu order. */
export const ACADEMIC_PAGES = [
  "sessions",
  "classes",
  "sections",
  "groups",
  "subjects",
  "class-subjects",
  "periods",
  "rooms",
  "holidays",
] as const;

/**
 * The form field a unique-index error belongs to: the column named in the index
 * ("designations_name_en_key" -> name_en) when the form has it, else the entity's main
 * unique field.
 */
export function duplicateField(
  message: string | undefined,
  fields: readonly string[],
  fallback: string,
): string {
  const index = /"([a-z0-9_]+)"/.exec(message ?? "")?.[1] ?? "";
  const named = [...fields]
    .sort((a, b) => b.length - a.length)
    .find((f) => index.includes(`_${f}_`) || index.endsWith(`_${f}_key`));
  return named ?? fallback;
}
