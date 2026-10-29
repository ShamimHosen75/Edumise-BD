import "server-only";

import type { Locale } from "@/i18n/config";
import type { DueItem } from "@/lib/collection";
import { periodNamer } from "@/lib/fee-periods";
import { lateFine, type FineRule } from "@/lib/fees";
import { pickLocalized, toAsciiDigits } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type FoundStudent = {
  id: number;
  code: string;
  name: string;
  section: string;
  roll: number | null;
};

export type RawEnrolled = {
  id: number;
  student_code: string;
  full_name_en: string;
  full_name_bn: string;
  enrollments: {
    session_id: number;
    roll: number;
    section: Named & { class: Named };
  }[];
};

export function found(s: RawEnrolled, sessionId: number | null, lang: Locale) {
  const en = s.enrollments.find((e) => e.session_id === sessionId);
  return {
    id: s.id,
    code: s.student_code,
    name: pickLocalized(s, "full_name", lang),
    section: en
      ? `${pickLocalized(en.section.class, "name", lang)} ${pickLocalized(en.section, "name", lang)}`
      : "",
    roll: en?.roll ?? null,
  } satisfies FoundStudent;
}

export const ENROLLED = `id, student_code, full_name_en, full_name_bn,
  enrollments(session_id, roll, section:sections(name_en, name_bn, class:classes(name_en, name_bn)))`;

/**
 * Students by ID (10 digits), roll in the current session (1–3 digits) or name.
 * At most 20.
 */
export async function findStudents(
  db: Client,
  query: string,
  lang: Locale,
): Promise<FoundStudent[]> {
  const q = toAsciiDigits(query).trim();
  if (!q) return [];
  const { data: session } = await db
    .from("academic_sessions")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  const sessionId = session?.id ?? null;
  let rows: RawEnrolled[] = [];
  if (/^\d{1,3}$/.test(q)) {
    const { data } = await db
      .from("enrollments")
      .select(`student:students!inner(${ENROLLED})`)
      .eq("session_id", sessionId ?? 0)
      .eq("roll", Number(q))
      .limit(20);
    rows = (data ?? []).map((r) => r.student as unknown as RawEnrolled);
  } else if (/^\d{4,10}$/.test(q)) {
    const { data } = await db
      .from("students")
      .select(ENROLLED)
      .like("student_code", `${q}%`)
      .order("student_code")
      .limit(20);
    rows = (data ?? []) as unknown as RawEnrolled[];
  } else {
    // Wildcards typed by the user are matched as plain characters.
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const results = await Promise.all(
      (["full_name_en", "full_name_bn"] as const).map((col) =>
        db.from("students").select(ENROLLED).ilike(col, like).limit(20),
      ),
    );
    const seen = new Set<number>();
    rows = (results.flatMap((r) => r.data ?? []) as unknown as RawEnrolled[])
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .slice(0, 20);
  }
  return rows
    .map((r) => found(r, sessionId, lang))
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) || (a.roll ?? 0) - (b.roll ?? 0),
    );
}

/** One student for the collect screen (null if not found). */
export async function studentForCollect(
  db: Client,
  id: number,
  lang: Locale,
): Promise<FoundStudent | null> {
  const [{ data }, { data: session }] = await Promise.all([
    db.from("students").select(ENROLLED).eq("id", id).maybeSingle(),
    db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .maybeSingle(),
  ]);
  return data
    ? found(data as unknown as RawEnrolled, session?.id ?? null, lang)
    : null;
}

export type CollectItem = DueItem & {
  invoiceNo: string;
  head: string;
  period: string;
  /** A late fine worked out today, not yet frozen (its id is minus the invoice id). */
  live: boolean;
};

/**
 * What a student still owes, item by item, in payment order. An invoice without a
 * frozen late fine gets a live fine line, frozen when it is paid.
 */
export async function collectItems(
  db: Client,
  studentId: number,
  rule: FineRule,
  lang: Locale,
): Promise<CollectItem[]> {
  const [{ data: invoices }, { data: balances }, periodName, fineHead] =
    await Promise.all([
      db
        .from("invoices")
        .select(
          `id, invoice_no, due_on, total, paid,
           items:invoice_items(id, period_key, is_fine, head:fee_heads(name_en, name_bn, sort_order))`,
        )
        .eq("student_id", studentId)
        .in("status", ["unpaid", "partial"])
        .order("due_on")
        .order("id"),
      db
        .from("invoice_item_balances")
        .select("id, outstanding")
        .eq("student_id", studentId),
      periodNamer(db, lang),
      db
        .from("fee_heads")
        .select("name_en, name_bn")
        .eq("code", "LATE_FINE")
        .maybeSingle(),
    ]);
  const owed = new Map((balances ?? []).map((b) => [b.id!, b.outstanding!]));
  const today = dhakaToday();
  const out: CollectItem[] = [];
  for (const inv of invoices ?? []) {
    const items = inv.items as unknown as {
      id: number;
      period_key: string;
      is_fine: boolean;
      head: Named & { sort_order: number };
    }[];
    const base = {
      invoiceId: inv.id,
      invoiceNo: inv.invoice_no,
      dueOn: inv.due_on,
    };
    if (!items.some((i) => i.is_fine)) {
      const fine = lateFine(rule, inv.due_on, today, inv.total - inv.paid);
      if (fine > 0 && fineHead.data)
        out.push({
          ...base,
          id: -inv.id,
          isFine: true,
          outstanding: fine,
          head: pickLocalized(fineHead.data, "name", lang),
          period: "",
          live: true,
        });
    }
    for (const i of items.sort(
      (a, b) => a.head.sort_order - b.head.sort_order,
    )) {
      const outstanding = owed.get(i.id) ?? 0;
      if (outstanding <= 0) continue;
      out.push({
        ...base,
        id: i.id,
        isFine: i.is_fine,
        outstanding,
        head: pickLocalized(i.head, "name", lang),
        period: i.is_fine ? "" : periodName(i.period_key),
        live: false,
      });
    }
  }
  return out;
}
