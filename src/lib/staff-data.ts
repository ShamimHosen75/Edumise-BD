import "server-only";

import type { StaffListRow } from "@/components/dashboard/staff/staff-table";
import type { Locale } from "@/i18n/config";
import { localizeDigits, pickLocalized } from "@/lib/format";
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

type Named = { name_en: string; name_bn: string };
const one = <T>(v: unknown) => v as T;

export async function staffList(db: Client): Promise<StaffListRow[]> {
  return rows(
    await db
      .from("staff")
      .select(
        "id, full_name_en, full_name_bn, subject_en, subject_bn, left_on, sort_order, designation:designations(rank, name_en, name_bn), profile:profiles(is_active)",
      )
      .order("sort_order"),
  ).map((s) => {
    const d = one<Named & { rank: number }>(s.designation);
    const p = one<{ is_active: boolean } | null>(s.profile);
    return {
      id: s.id,
      full_name_en: s.full_name_en,
      full_name_bn: s.full_name_bn,
      subject_en: s.subject_en,
      subject_bn: s.subject_bn,
      designation_en: d.name_en,
      designation_bn: d.name_bn,
      rank: d.rank,
      is_current: s.left_on === null,
      login: p ? (p.is_active ? "active" : "off") : "none",
    };
  });
}

export async function designations(db: Client) {
  return rows(
    await db
      .from("designations")
      .select("id, rank, name_en, name_bn, is_teaching")
      .order("rank"),
  );
}

/** Everything the staff edit page shows (admins only, by RLS and the page check). */
export async function staffDetail(db: Client, id: number, lang: Locale) {
  const { data: staff } = await db
    .from("staff")
    .select(
      "*, private:staff_private(*), profile:profiles(email, role, is_active)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!staff) return null;
  const [sessions, sections, mappings, subjects, assignments] =
    await Promise.all([
      db
        .from("academic_sessions")
        .select("id, name, is_current")
        .order("starts_on", { ascending: false }),
      db
        .from("sections")
        .select(
          "id, class_id, name_en, name_bn, class:classes(level, name_en, name_bn)",
        ),
      db.from("class_subjects").select("class_id, subject_id"),
      db
        .from("subjects")
        .select("id, code, name_en, name_bn")
        .order("sort_order"),
      db
        .from("teacher_assignments")
        .select(
          "id, session:academic_sessions(name), section:sections(name_en, name_bn, class:classes(level, name_en, name_bn)), subject:subjects(name_en, name_bn)",
        )
        .eq("staff_id", id),
    ]);
  const local = (v: Named) => pickLocalized(v, "name", lang);
  const sectionLabel = (s: Named & { class: unknown }) => {
    const c = one<Named & { level: number }>(s.class);
    return { label: `${local(c)} ${local(s)}`, level: c.level };
  };
  const subjectsByClass = new Map<number, number[]>();
  for (const m of rows(mappings))
    subjectsByClass.set(m.class_id, [
      ...(subjectsByClass.get(m.class_id) ?? []),
      m.subject_id,
    ]);

  return {
    staff,
    private: one<Record<string, string | null> | null>(staff.private),
    login: one<{
      email: string | null;
      role: string | null;
      is_active: boolean;
    } | null>(staff.profile),
    sessions: rows(sessions).map((s) => ({
      id: s.id,
      label: localizeDigits(s.name, lang),
      current: s.is_current,
    })),
    sections: rows(sections)
      .map((s) => ({
        id: s.id,
        ...sectionLabel(s),
        subjectIds: [...new Set(subjectsByClass.get(s.class_id))],
      }))
      .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label)),
    subjects: rows(subjects).map((s) => ({
      id: s.id,
      label: `${s.code} · ${local(s)}`,
    })),
    assignments: rows(assignments).map((a) => {
      const section = one<Named & { class: unknown }>(a.section);
      const { label, level } = sectionLabel(section);
      return {
        id: a.id,
        session: localizeDigits(one<{ name: string }>(a.session).name, lang),
        section: label,
        level,
        subject: local(one<Named>(a.subject)),
      };
    }),
  };
}
