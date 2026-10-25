import "server-only";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };
const one = <T>(v: unknown) => v as T;

export type StudentListRow = {
  id: number;
  code: string;
  name: string;
  roll: number;
  level: number;
  className: string;
  section: string;
  sectionId: number;
  group: string;
  status: string;
  phone: string;
};

export async function sessions(db: Client) {
  const { data } = await db
    .from("academic_sessions")
    .select("id, name, is_current, starts_on")
    .order("starts_on", { ascending: false });
  return data ?? [];
}

/** Everyone enrolled in a session, with class, section, group and primary guardian mobile. */
export async function studentList(
  db: Client,
  sessionId: number,
  lang: Locale,
): Promise<StudentListRow[]> {
  const { data, error } = await db
    .from("enrollments")
    .select(
      "roll, section_id, group:groups(name_en, name_bn), section:sections(name_en, name_bn, class:classes(level, name_en, name_bn)), student:students(id, student_code, full_name_en, full_name_bn, status, student_guardians(is_primary, guardian:guardians(phone)))",
    )
    .eq("session_id", sessionId)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((e) => {
      const section = one<Named & { class: Named & { level: number } }>(
        e.section,
      );
      const st = one<{
        id: number;
        student_code: string;
        full_name_en: string;
        full_name_bn: string;
        status: string;
        student_guardians: {
          is_primary: boolean;
          guardian: { phone: string };
        }[];
      }>(e.student);
      const group = one<Named | null>(e.group);
      return {
        id: st.id,
        code: st.student_code,
        name: pickLocalized(st, "full_name", lang),
        roll: e.roll,
        level: section.class.level,
        className: pickLocalized(section.class, "name", lang),
        section: pickLocalized(section, "name", lang),
        sectionId: e.section_id,
        group: group ? pickLocalized(group, "name", lang) : "",
        status: st.status,
        phone:
          st.student_guardians.find((g) => g.is_primary)?.guardian.phone ??
          st.student_guardians[0]?.guardian.phone ??
          "",
      };
    })
    .sort(
      (a, b) =>
        a.level - b.level ||
        a.section.localeCompare(b.section) ||
        a.roll - b.roll,
    );
}

export type SectionOption = {
  id: number;
  classId: number;
  level: number;
  name: string;
};

/** Every section as "Class 6 A", by class then name. */
export async function sectionOptions(
  db: Client,
  lang: Locale,
): Promise<SectionOption[]> {
  const { data } = await db
    .from("sections")
    .select(
      "id, class_id, name_en, name_bn, class:classes(level, name_en, name_bn)",
    );
  return (data ?? [])
    .map((s) => {
      const c = one<Named & { level: number }>(s.class);
      return {
        id: s.id,
        classId: s.class_id,
        level: c.level,
        name: `${pickLocalized(c, "name", lang)} ${pickLocalized(s, "name", lang)}`,
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export async function groupOptions(db: Client, lang: Locale) {
  const { data } = await db
    .from("groups")
    .select("id, name_en, name_bn")
    .order("id");
  return (data ?? []).map((g) => ({
    id: g.id,
    name: pickLocalized(g, "name", lang),
  }));
}

export async function classChoices(db: Client, lang: Locale) {
  const { data } = await db
    .from("classes")
    .select("id, level, name_en, name_bn")
    .order("level");
  return (data ?? []).map((c) => ({
    id: c.id,
    level: c.level,
    name: pickLocalized(c, "name", lang),
  }));
}
