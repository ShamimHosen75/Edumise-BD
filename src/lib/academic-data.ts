import "server-only";

import { pickLocalized } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

function rows<T>({
  data,
  error,
}: {
  data: T[] | null;
  error: { message: string } | null;
}) {
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Data for each academic setup page (admins: RLS lets them read everything here). */
export const academicData = {
  sessions: async (db: Client) =>
    rows(
      await db
        .from("academic_sessions")
        .select("id, name, starts_on, ends_on, is_current")
        .order("starts_on", { ascending: false }),
    ),
  classes: async (db: Client) =>
    rows(
      await db
        .from("classes")
        .select("id, level, name_en, name_bn, sections(count)")
        .order("level"),
    ).map(({ sections, ...c }) => ({
      ...c,
      sections: (sections as unknown as { count: number }[])[0]?.count ?? 0,
    })),
  classList: async (db: Client) =>
    rows(
      await db
        .from("classes")
        .select("id, level, name_en, name_bn")
        .order("level"),
    ),
  groups: async (db: Client) =>
    rows(
      await db
        .from("groups")
        .select("id, code, name_en, name_bn")
        .order("name_en"),
    ),
  subjects: async (db: Client) =>
    rows(
      await db
        .from("subjects")
        .select("id, code, name_en, name_bn, type, sort_order")
        .order("sort_order"),
    ),
  sections: async (db: Client) =>
    rows(
      await db
        .from("sections")
        .select(
          "id, class_id, name_en, name_bn, capacity, class_teacher_id, class:classes(level, name_en, name_bn), teacher:staff(full_name_en, full_name_bn)",
        ),
    )
      .map((s) => {
        const cls = s.class as unknown as {
          level: number;
          name_en: string;
          name_bn: string;
        };
        const teacher = s.teacher as unknown as {
          full_name_en: string;
          full_name_bn: string;
        } | null;
        return {
          id: s.id,
          class_id: s.class_id,
          name_en: s.name_en,
          name_bn: s.name_bn,
          capacity: s.capacity,
          class_teacher_id: s.class_teacher_id,
          class_level: cls.level,
          class_name_en: cls.name_en,
          class_name_bn: cls.name_bn,
          teacher_en: teacher?.full_name_en ?? null,
          teacher_bn: teacher?.full_name_bn ?? null,
        };
      })
      // Class order, then section name: the table's sort keeps this order within a class.
      .sort(
        (a, b) =>
          a.class_level - b.class_level || a.name_en.localeCompare(b.name_en),
      ),
  /** Current teaching staff, for the class teacher choice. */
  teachers: async (db: Client, lang: Locale) =>
    rows(
      await db
        .from("staff")
        .select(
          "id, full_name_en, full_name_bn, designation:designations(is_teaching)",
        )
        .is("left_on", null),
    )
      .filter(
        (s) =>
          (s.designation as unknown as { is_teaching: boolean }).is_teaching,
      )
      .map((s) => ({
        id: s.id,
        name_en: s.full_name_en,
        name_bn: s.full_name_bn,
      }))
      .sort((a, b) =>
        pickLocalized(a, "name", lang).localeCompare(
          pickLocalized(b, "name", lang),
        ),
      ),
  mappings: async (db: Client) =>
    rows(
      await db.from("class_subjects").select("class_id, group_id, subject_id"),
    ),
};
