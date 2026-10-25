import {
  classSchema,
  groupSchema,
  sectionSchema,
  sessionSchema,
  subjectSchema,
} from "@/lib/validation/academic";

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
] as const;
