import "server-only";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type PortalStudent = {
  id: number;
  name: string;
  code: string;
  status: string;
  enrollment: {
    session: string;
    className: string;
    section: string;
    group: string;
    roll: number;
  } | null;
  guardians: { name: string; relation: string }[];
};

const SELECT =
  "id, student_code, full_name_en, full_name_bn, status, enrollments(roll, session:academic_sessions(name, is_current), section:sections(name_en, name_bn, class:classes(name_en, name_bn)), group:groups(name_en, name_bn)), student_guardians(relation, is_primary, guardian:guardians(full_name_en, full_name_bn))";

type Row = {
  id: number;
  student_code: string;
  full_name_en: string;
  full_name_bn: string;
  status: string;
  enrollments: {
    roll: number;
    session: { name: string; is_current: boolean };
    section: Named & { class: Named };
    group: Named | null;
  }[];
  student_guardians: {
    relation: string;
    is_primary: boolean;
    guardian: { full_name_en: string; full_name_bn: string };
  }[];
};

function toPortal(r: Row, lang: Locale): PortalStudent {
  const e = r.enrollments.find((x) => x.session.is_current);
  return {
    id: r.id,
    name: pickLocalized(r, "full_name", lang),
    code: r.student_code,
    status: r.status,
    enrollment: e
      ? {
          session: e.session.name,
          className: pickLocalized(e.section.class, "name", lang),
          section: pickLocalized(e.section, "name", lang),
          group: e.group ? pickLocalized(e.group, "name", lang) : "",
          roll: e.roll,
        }
      : null,
    guardians: r.student_guardians
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((g) => ({
        name: pickLocalized(g.guardian, "full_name", lang),
        relation: g.relation,
      })),
  };
}

/** The signed-in guardian's children (RLS: only children linked to this login). */
export async function myChildren(
  db: Client,
  profileId: string,
  lang: Locale,
): Promise<PortalStudent[]> {
  const { data: guardians } = await db
    .from("guardians")
    .select("id")
    .eq("profile_id", profileId);
  const ids = (guardians ?? []).map((g) => g.id);
  if (!ids.length) return [];
  const { data: links } = await db
    .from("student_guardians")
    .select("student_id")
    .in("guardian_id", ids);
  const studentIds = [...new Set((links ?? []).map((l) => l.student_id))];
  if (!studentIds.length) return [];
  const { data, error } = await db
    .from("students")
    .select(SELECT)
    .in("id", studentIds)
    .order("full_name_en");
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map((r) => toPortal(r, lang));
}

/** The signed-in student's own record. */
export async function myProfile(
  db: Client,
  profileId: string,
  lang: Locale,
): Promise<PortalStudent | null> {
  const { data, error } = await db
    .from("students")
    .select(SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPortal(data as unknown as Row, lang) : null;
}
