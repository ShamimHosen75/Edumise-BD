import "server-only";

import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };
const one = <T>(v: unknown) => v as T;

export type GuardianRow = {
  id: number;
  name: string;
  phone: string;
  occupation: string;
  relation: "father" | "mother" | "other";
  isPrimary: boolean;
  login: LoginState;
  /** Other children of this guardian at the school. */
  children: { id: number; name: string }[];
};

export type HistoryRow = {
  id: number;
  sessionId: number;
  session: string;
  current: boolean;
  className: string;
  section: string;
  sectionId: number;
  groupId: number | null;
  group: string;
  roll: number;
};

/** A private file as a link valid for 10 minutes, made for this request only. */
async function signed(db: Client, path: string | null) {
  if (!path) return null;
  const { data } = await db.storage
    .from("private-docs")
    .createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export type LoginState = "none" | "active" | "off";
const loginState = (p: { is_active: boolean } | null): LoginState =>
  p ? (p.is_active ? "active" : "off") : "none";

/** Everything the office profile shows about one student. RLS limits it to admins. */
export async function studentDetail(db: Client, id: number, lang: Locale) {
  const { data: student } = await db
    .from("students")
    .select(
      "*, profile:profiles(is_active), enrollments(id, session_id, section_id, group_id, roll, session:academic_sessions(name, starts_on, is_current), section:sections(name_en, name_bn, class:classes(level, name_en, name_bn)), group:groups(name_en, name_bn)), student_guardians(relation, is_primary, guardian:guardians(id, full_name_en, full_name_bn, phone, occupation, profile:profiles(is_active)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!student) return null;

  const history: HistoryRow[] = one<
    {
      id: number;
      session_id: number;
      section_id: number;
      group_id: number | null;
      roll: number;
      session: { name: string; starts_on: string; is_current: boolean };
      section: Named & { class: Named & { level: number } };
      group: Named | null;
    }[]
  >(student.enrollments)
    .sort((a, b) => b.session.starts_on.localeCompare(a.session.starts_on))
    .map((e) => ({
      id: e.id,
      sessionId: e.session_id,
      session: e.session.name,
      current: e.session.is_current,
      className: pickLocalized(e.section.class, "name", lang),
      section: pickLocalized(e.section, "name", lang),
      sectionId: e.section_id,
      groupId: e.group_id,
      group: e.group ? pickLocalized(e.group, "name", lang) : "",
      roll: e.roll,
    }));

  const links = one<
    {
      relation: GuardianRow["relation"];
      is_primary: boolean;
      guardian: Named & {
        id: number;
        full_name_en: string;
        full_name_bn: string;
        phone: string;
        occupation: string;
        profile: { is_active: boolean } | null;
      };
    }[]
  >(student.student_guardians);
  const guardianIds = links.map((l) => l.guardian.id);
  const [{ data: siblings }, { data: documents }, { data: applications }] =
    await Promise.all([
      guardianIds.length
        ? db
            .from("student_guardians")
            .select(
              "guardian_id, student:students(id, full_name_en, full_name_bn)",
            )
            .in("guardian_id", guardianIds)
            .neq("student_id", id)
        : Promise.resolve({ data: [] }),
      db
        .from("student_documents")
        .select("id, label, file_path, mime_type, file_size, created_at")
        .eq("student_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("admission_applications")
        .select(
          "tracking_no, documents:admission_documents(kind, file_path, file_size)",
        )
        .eq("student_id", id),
    ]);
  const guardians: GuardianRow[] = links
    .map((l) => ({
      id: l.guardian.id,
      name: pickLocalized(l.guardian, "full_name", lang),
      phone: l.guardian.phone,
      occupation: l.guardian.occupation,
      relation: l.relation,
      isPrimary: l.is_primary,
      login: loginState(l.guardian.profile),
      children: (siblings ?? [])
        .filter((s) => s.guardian_id === l.guardian.id)
        .map((s) => {
          const c = one<{
            id: number;
            full_name_en: string;
            full_name_bn: string;
          }>(s.student);
          return { id: c.id, name: pickLocalized(c, "full_name", lang) };
        }),
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const admissionDocs = (applications ?? []).flatMap((a) =>
    one<{ kind: string; file_path: string; file_size: number }[]>(
      a.documents,
    ).map((d) => ({ ...d, tracking: a.tracking_no })),
  );

  return {
    student,
    login: loginState(one<{ is_active: boolean } | null>(student.profile)),
    photoUrl: await signed(db, student.photo_path),
    history,
    current: history.find((h) => h.current) ?? null,
    guardians,
    documents: await Promise.all(
      (documents ?? []).map(async (d) => ({
        ...d,
        url: await signed(db, d.file_path),
      })),
    ),
    admissionDocuments: await Promise.all(
      admissionDocs.map(async (d) => ({
        ...d,
        url: await signed(db, d.file_path),
      })),
    ),
  };
}
export type StudentDetail = NonNullable<
  Awaited<ReturnType<typeof studentDetail>>
>;
