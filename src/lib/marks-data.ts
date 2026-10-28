import "server-only";

import type { Locale } from "@/i18n/config";
import { isAdmin } from "@/lib/attendance-data";
import type { CurrentUser } from "@/lib/auth/session";
import { pickLocalized } from "@/lib/format";
import type { MarkRow } from "@/lib/marks";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type MarksExam = { id: number; name: string; status: string };

/** Exams taking marks (admins also see exams in review). */
export async function marksExams(
  db: Client,
  user: CurrentUser,
  lang: Locale,
): Promise<MarksExam[]> {
  const statuses = isAdmin(user) ? ["marks_entry", "review"] : ["marks_entry"];
  const { data } = await db
    .from("exams")
    .select(
      "id, name_en, name_bn, status, session:academic_sessions!inner(is_current)",
    )
    .eq("session.is_current", true)
    .in("status", statuses as ("marks_entry" | "review")[])
    .order("starts_on");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: pickLocalized(e, "name", lang),
    status: e.status,
  }));
}

export type MarksEntry = {
  /** "examSubjectId-sectionId" */
  key: string;
  examSubjectId: number;
  sectionId: number;
  label: string;
  section: string;
  subject: string;
  cq_full: number;
  mcq_full: number;
  practical_full: number;
};

/** Subject + section pairs the user may enter for this exam (teachers: their own). */
export async function marksEntries(
  db: Client,
  user: CurrentUser,
  examId: number,
  lang: Locale,
): Promise<MarksEntry[]> {
  const { data: subjects } = await db
    .from("exam_subjects")
    .select(
      "id, class_id, subject_id, cq_full, mcq_full, practical_full, subject:subjects(name_en, name_bn, sort_order), class:classes(level, name_en, name_bn, sections(id, name_en, name_bn))",
    )
    .eq("exam_id", examId);
  let allowed: Set<string> | null = null;
  if (!isAdmin(user)) {
    const { data: staff } = await db
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    const { data: assigned } = staff
      ? await db
          .from("teacher_assignments")
          .select(
            "section_id, subject_id, session:academic_sessions!inner(is_current)",
          )
          .eq("staff_id", staff.id)
          .eq("session.is_current", true)
      : { data: [] };
    allowed = new Set(
      (assigned ?? []).map((a) => `${a.subject_id}:${a.section_id}`),
    );
  }
  return (subjects ?? [])
    .flatMap((es) => {
      const cls = es.class as unknown as Named & {
        level: number;
        sections: (Named & { id: number })[];
      };
      const sub = es.subject as unknown as Named & { sort_order: number };
      return cls.sections
        .filter((s) => !allowed || allowed.has(`${es.subject_id}:${s.id}`))
        .map((s) => {
          const section = `${pickLocalized(cls, "name", lang)} ${pickLocalized(s, "name", lang)}`;
          const subject = pickLocalized(sub, "name", lang);
          return {
            key: `${es.id}-${s.id}`,
            examSubjectId: es.id,
            sectionId: s.id,
            label: `${section} · ${subject}`,
            section,
            subject,
            cq_full: es.cq_full,
            mcq_full: es.mcq_full,
            practical_full: es.practical_full,
            order: [cls.level, s.name_en, sub.sort_order] as const,
          };
        });
    })
    .sort(
      (a, b) =>
        a.order[0] - b.order[0] ||
        a.order[1].localeCompare(b.order[1]) ||
        a.order[2] - b.order[2],
    )
    .map((e) => {
      const { order, ...rest } = e;
      void order;
      return rest;
    });
}

/** Saved marks of the section's students for one exam subject, and the lock. */
export async function savedMarks(
  db: Client,
  examSubjectId: number,
  sectionId: number,
  studentIds: number[],
) {
  const [rows, { data: lock }] = await Promise.all([
    studentIds.length
      ? fetchAll((a, b) =>
          db
            .from("marks")
            .select("student_id, cq, mcq, practical, is_absent")
            .eq("exam_subject_id", examSubjectId)
            .in("student_id", studentIds)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
    db
      .from("mark_locks")
      .select("locked_at")
      .eq("exam_subject_id", examSubjectId)
      .eq("section_id", sectionId)
      .maybeSingle(),
  ]);
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return {
    marks: rows.map((r): MarkRow => ({
      student_id: r.student_id,
      cq: num(r.cq),
      mcq: num(r.mcq),
      practical: num(r.practical),
      is_absent: r.is_absent,
    })),
    lockedAt: lock?.locked_at ?? null,
  };
}
