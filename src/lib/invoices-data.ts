import "server-only";

import type { Locale } from "@/i18n/config";
import { lateFine, type FineRule, type InvoiceStatus } from "@/lib/fees";
import { pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type InvoiceListRow = {
  id: number;
  invoiceNo: string;
  studentCode: string;
  student: string;
  section: string;
  roll: number | null;
  periods: string[];
  issuedOn: string;
  dueOn: string;
  status: InvoiceStatus;
  total: number;
  paid: number;
  /** Late fine today (live). */
  fine: number;
};

export type InvoiceFilter = {
  sessionId: number;
  status?: InvoiceStatus;
  period?: string;
  classId?: number;
};

type RawStudent = {
  student_code: string;
  full_name_en: string;
  full_name_bn: string;
  enrollments: {
    session_id: number;
    roll: number;
    section: Named & { class_id: number; class: Named };
  }[];
};

/** Invoices of a session, newest first, with the live late fine. */
export async function invoiceList(
  db: Client,
  f: InvoiceFilter,
  rule: FineRule,
  lang: Locale,
): Promise<InvoiceListRow[]> {
  const today = dhakaToday();
  const rows = await fetchAll((a, b) => {
    let q = db
      .from("invoices")
      .select(
        `id, invoice_no, issued_on, due_on, status, total, paid,
         student:students!inner(student_code, full_name_en, full_name_bn,
           enrollments(session_id, roll, section:sections(class_id, name_en, name_bn, class:classes(name_en, name_bn)))),
         items:invoice_items!inner(period_key)`,
      )
      .eq("session_id", f.sessionId);
    if (f.status) q = q.eq("status", f.status);
    if (f.period) q = q.eq("items.period_key", f.period);
    return q.order("id", { ascending: false }).range(a, b);
  });
  return rows
    .map((r) => {
      const st = r.student as unknown as RawStudent;
      const en = st.enrollments.find((e) => e.session_id === f.sessionId);
      return {
        classId: en?.section.class_id ?? null,
        row: {
          id: r.id,
          invoiceNo: r.invoice_no,
          studentCode: st.student_code,
          student: pickLocalized(st, "full_name", lang),
          section: en
            ? `${pickLocalized(en.section.class, "name", lang)} ${pickLocalized(en.section, "name", lang)}`
            : "",
          roll: en?.roll ?? null,
          periods: [
            ...new Set(
              (r.items as { period_key: string }[]).map((i) => i.period_key),
            ),
          ],
          issuedOn: r.issued_on,
          dueOn: r.due_on,
          status: r.status,
          total: r.total,
          paid: r.paid,
          fine:
            r.status === "cancelled"
              ? 0
              : lateFine(rule, r.due_on, today, r.total - r.paid),
        } satisfies InvoiceListRow,
      };
    })
    .filter((x) => !f.classId || x.classId === f.classId)
    .map((x) => x.row);
}

export type InvoiceDetail = InvoiceListRow & {
  items: {
    head: string;
    periodKey: string;
    gross: number;
    waiver: number;
    net: number;
  }[];
};

export async function invoiceDetail(
  db: Client,
  id: number,
  rule: FineRule,
  lang: Locale,
): Promise<InvoiceDetail | null> {
  const { data: r } = await db
    .from("invoices")
    .select(
      `id, invoice_no, session_id, issued_on, due_on, status, total, paid,
       student:students(student_code, full_name_en, full_name_bn,
         enrollments(session_id, roll, section:sections(class_id, name_en, name_bn, class:classes(name_en, name_bn)))),
       items:invoice_items(period_key, gross, waiver, net, head:fee_heads(name_en, name_bn, sort_order))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const st = r.student as unknown as RawStudent;
  const en = st.enrollments.find((e) => e.session_id === r.session_id);
  const items = (
    r.items as unknown as {
      period_key: string;
      gross: number;
      waiver: number;
      net: number;
      head: Named & { sort_order: number };
    }[]
  ).sort((a, b) => a.head.sort_order - b.head.sort_order);
  return {
    id: r.id,
    invoiceNo: r.invoice_no,
    studentCode: st.student_code,
    student: pickLocalized(st, "full_name", lang),
    section: en
      ? `${pickLocalized(en.section.class, "name", lang)} ${pickLocalized(en.section, "name", lang)}`
      : "",
    roll: en?.roll ?? null,
    periods: [...new Set(items.map((i) => i.period_key))],
    issuedOn: r.issued_on,
    dueOn: r.due_on,
    status: r.status,
    total: r.total,
    paid: r.paid,
    fine:
      r.status === "cancelled"
        ? 0
        : lateFine(rule, r.due_on, dhakaToday(), r.total - r.paid),
    items: items.map((i) => ({
      head: pickLocalized(i.head, "name", lang),
      periodKey: i.period_key,
      gross: i.gross,
      waiver: i.waiver,
      net: i.net,
    })),
  };
}
