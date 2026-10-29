import "server-only";

import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  certificateBody,
  type CertificateFacts,
  type CertificateType,
  type Gender,
  type TemplateText,
} from "@/lib/certificates";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type CertificateRow = {
  id: number;
  reference: string;
  type: CertificateType;
  student_id: number | null;
  student_name_en: string;
  student_name_bn: string;
  body_en: string;
  body_bn: string;
  issued_on: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  studentCode: string | null;
};

const SELECT =
  "id, reference, type, student_id, student_name_en, student_name_bn, body_en, body_bn, issued_on, revoked_at, revoke_reason, student:students(student_code)";

const toRow = (r: Record<string, unknown>): CertificateRow => ({
  ...(r as Omit<CertificateRow, "studentCode">),
  studentCode:
    (r.student as { student_code: string } | null)?.student_code ?? null,
});

/** Issued certificates, newest first (admins; RLS). */
export async function listCertificates(db: Client): Promise<CertificateRow[]> {
  const { data, error } = await db
    .from("certificates")
    .select(SELECT)
    .order("id", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toRow(r as Record<string, unknown>));
}

export async function certificateById(
  db: Client,
  id: number,
): Promise<CertificateRow | null> {
  const { data } = await db
    .from("certificates")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? toRow(data as Record<string, unknown>) : null;
}

export type CertificateStudent = {
  id: number;
  code: string;
  name: string;
  /** "Class 6 A, roll 2" style summary in the page language. */
  info: string | null;
  status: string;
};

/**
 * A student found by student ID, with the certificate text drafted in both languages
 * from the latest enrolment, the guardians named as father/mother and the birth date.
 */
export async function draftCertificate(
  db: Client,
  code: string,
  type: CertificateType,
  lang: Locale,
): Promise<{
  student: CertificateStudent;
  body_en: string;
  body_bn: string;
} | null> {
  const { data: s } = await db
    .from("students")
    .select(
      "id, student_code, full_name_en, full_name_bn, gender, status, birth_date, enrollments(roll, session:academic_sessions(name, starts_on), section:sections(name_en, name_bn, class:classes(name_en, name_bn))), student_guardians(relation, guardian:guardians(full_name_en, full_name_bn))",
    )
    .eq("student_code", code)
    .maybeSingle();
  if (!s) return null;
  const latest = (
    s.enrollments as unknown as {
      roll: number;
      session: { name: string; starts_on: string };
      section: Named & { class: Named };
    }[]
  ).sort((a, b) => b.session.starts_on.localeCompare(a.session.starts_on))[0];
  const parents = (
    s.student_guardians as unknown as {
      relation: string;
      guardian: { full_name_en: string; full_name_bn: string };
    }[]
  )
    .filter((g) => g.relation === "father" || g.relation === "mother")
    .sort((a) => (a.relation === "father" ? -1 : 1));

  const facts = (l: Locale): CertificateFacts => ({
    name: pickLocalized(s, "full_name", l),
    gender: s.gender as Gender,
    parents: parents.map((p) => pickLocalized(p.guardian, "full_name", l)),
    className: latest ? pickLocalized(latest.section.class, "name", l) : null,
    section: latest ? pickLocalized(latest.section, "name", l) : null,
    roll: latest ? localizeDigits(latest.roll, l) : null,
    session: latest ? localizeDigits(latest.session.name, l) : null,
    code: localizeDigits(s.student_code, l),
    birthDate: s.birth_date ? formatDate(s.birth_date, l, "long") : null,
  });
  const [en, bn, dict] = await Promise.all([
    getDictionary("en"),
    getDictionary("bn"),
    getDictionary(lang),
  ]);
  const t = (d: typeof en) => d.certificates.templates as TemplateText;
  const f = facts(lang);
  return {
    student: {
      id: s.id,
      code: s.student_code,
      name: f.name,
      info: latest
        ? dict.certificates.studentInfo
            .replace("{name}", f.name)
            .replace("{class}", `${f.className} ${f.section}`)
            .replace("{roll}", f.roll!)
        : null,
      status: s.status,
    },
    body_en: certificateBody(type, t(en), facts("en")),
    body_bn: certificateBody(type, t(bn), facts("bn")),
  };
}
