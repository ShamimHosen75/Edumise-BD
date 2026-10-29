import "server-only";

import type { Locale } from "@/i18n/config";
import {
  lateFine,
  planInvoices,
  type FeeFrequency,
  type FineRule,
  type Structure,
  type Waiver,
} from "@/lib/fees";
import { pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type FeeHeadRow = {
  id: number;
  code: string;
  name_en: string;
  name_bn: string;
  frequency: FeeFrequency;
  sort_order: number;
};

export async function feeHeads(db: Client): Promise<FeeHeadRow[]> {
  const { data, error } = await db
    .from("fee_heads")
    .select("id, code, name_en, name_bn, frequency, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SessionOption = {
  id: number;
  name: string;
  current: boolean;
  starts_on: string;
  ends_on: string;
};

/** Sessions, newest first. */
export async function feeSessions(db: Client): Promise<SessionOption[]> {
  const { data } = await db
    .from("academic_sessions")
    .select("id, name, is_current, starts_on, ends_on")
    .order("starts_on", { ascending: false });
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    current: s.is_current,
    starts_on: s.starts_on,
    ends_on: s.ends_on,
  }));
}

export type GridRow = {
  classId: number;
  groupId: number | null;
  label: string;
  level: number;
};

/** Rows of the structure grid: each class, and for Classes 9–10 each group (override). */
export async function structureRows(
  db: Client,
  lang: Locale,
): Promise<GridRow[]> {
  const [{ data: classes }, { data: groups }] = await Promise.all([
    db.from("classes").select("id, level, name_en, name_bn").order("level"),
    db.from("groups").select("id, name_en, name_bn").order("id"),
  ]);
  return (classes ?? []).flatMap((c) => [
    {
      classId: c.id,
      groupId: null,
      label: pickLocalized(c, "name", lang),
      level: c.level,
    },
    ...(c.level >= 9
      ? (groups ?? []).map((g) => ({
          classId: c.id,
          groupId: g.id,
          label: `${pickLocalized(c, "name", lang)} · ${pickLocalized(g, "name", lang)}`,
          level: c.level,
        }))
      : []),
  ]);
}

export async function structures(
  db: Client,
  sessionId: number,
): Promise<Structure[]> {
  const rows = await fetchAll((a, b) =>
    db
      .from("fee_structures")
      .select("class_id, group_id, fee_head_id, amount")
      .eq("session_id", sessionId)
      .order("id")
      .range(a, b),
  );
  return rows.map((r) => ({
    classId: r.class_id,
    groupId: r.group_id,
    feeHeadId: r.fee_head_id,
    amount: r.amount,
  }));
}

export type WaiverRow = {
  id: number;
  studentId: number;
  studentCode: string;
  student: string;
  feeHeadId: number;
  head: string;
  kind: "percent" | "fixed";
  value: number;
  reason: string;
  approved: boolean;
};

export async function waivers(
  db: Client,
  sessionId: number,
  lang: Locale,
): Promise<WaiverRow[]> {
  const rows = await fetchAll((a, b) =>
    db
      .from("fee_waivers")
      .select(
        "id, student_id, fee_head_id, kind, value, reason, approved_at, student:students(student_code, full_name_en, full_name_bn), head:fee_heads(name_en, name_bn)",
      )
      .eq("session_id", sessionId)
      .order("id")
      .range(a, b),
  );
  return rows.map((r) => {
    const st = r.student as unknown as {
      student_code: string;
      full_name_en: string;
      full_name_bn: string;
    };
    return {
      id: r.id,
      studentId: r.student_id,
      studentCode: st.student_code,
      student: pickLocalized(st, "full_name", lang),
      feeHeadId: r.fee_head_id,
      head: pickLocalized(r.head as unknown as Named, "name", lang),
      kind: r.kind,
      value: r.value,
      reason: r.reason,
      approved: r.approved_at !== null,
    };
  });
}

export async function fineRule(
  db: Client,
): Promise<FineRule & { dueDays: number }> {
  const { data } = await db
    .from("fee_settings")
    .select("late_fine_per_day, late_fine_cap, grace_days, due_days")
    .maybeSingle();
  return {
    perDay: data?.late_fine_per_day ?? 0,
    cap: data?.late_fine_cap ?? 0,
    graceDays: data?.grace_days ?? 0,
    dueDays: data?.due_days ?? 15,
  };
}

/**
 * The invoice plan for a period: students of the classes enrolled in the session and
 * still at school, the session's structure, approved waivers, and what is already billed.
 */
export async function loadPlan(
  db: Client,
  p: {
    sessionId: number;
    classIds: number[];
    feeHeadIds: number[];
    periodKey: string;
  },
) {
  const [enrolled, rows, waived, billed] = await Promise.all([
    fetchAll((a, b) =>
      db
        .from("enrollments")
        .select(
          "student_id, group_id, section:sections!inner(class_id), student:students!inner(status)",
        )
        .eq("session_id", p.sessionId)
        .in("section.class_id", p.classIds)
        .not("student.status", "in", "(transferred,inactive)")
        .order("id")
        .range(a, b),
    ),
    structures(db, p.sessionId),
    fetchAll((a, b) =>
      db
        .from("fee_waivers")
        .select("student_id, fee_head_id, kind, value")
        .eq("session_id", p.sessionId)
        .not("approved_at", "is", null)
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("invoice_items")
        .select("student_id, fee_head_id")
        .eq("period_key", p.periodKey)
        .in("fee_head_id", p.feeHeadIds)
        .order("id")
        .range(a, b),
    ),
  ]);
  const byStudent = new Map<number, Map<number, Waiver[]>>();
  for (const w of waived) {
    const heads = byStudent.get(w.student_id) ?? new Map<number, Waiver[]>();
    heads.set(w.fee_head_id, [
      ...(heads.get(w.fee_head_id) ?? []),
      { kind: w.kind, value: w.value },
    ]);
    byStudent.set(w.student_id, heads);
  }
  return planInvoices({
    students: enrolled.map((e) => ({
      studentId: e.student_id,
      classId: (e.section as unknown as { class_id: number }).class_id,
      groupId: e.group_id,
    })),
    feeHeadIds: p.feeHeadIds,
    structures: rows,
    waivers: byStudent,
    billed: new Set(billed.map((b) => `${b.student_id}:${b.fee_head_id}`)),
  });
}

/** Late fine of an invoice today (live, open question 39). */
export const fineToday = (rule: FineRule, dueOn: string, outstanding: number) =>
  lateFine(rule, dueOn, dhakaToday(), outstanding);
