import "server-only";

import type { Locale } from "@/i18n/config";
import type { AnyPaymentMethod } from "@/lib/collection";
import { ENROLLED, found, type RawEnrolled } from "@/lib/collection-data";
import { periodNamer } from "@/lib/fee-periods";
import { lateFine, type FineRule } from "@/lib/fees";
import { pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type Receipt = {
  id: number;
  receiptNo: string;
  studentId: number;
  studentCode: string;
  student: string;
  section: string;
  roll: number | null;
  amount: number;
  method: AnyPaymentMethod;
  txnId: string | null;
  paidOn: string;
  note: string;
  collectedBy: string;
  cancelled: { at: string; reason: string } | null;
  /** Still owed today on the bills this receipt paid (late fines added later not included). */
  dueNow: number;
  lines: { invoiceNo: string; head: string; period: string; amount: number }[];
};

/** A receipt as the signed-in user may see it (RLS: staff, or the family). */
export async function receiptById(
  db: Client,
  id: number,
  lang: Locale,
): Promise<Receipt | null> {
  const { data: p } = await db
    .from("payments")
    .select(
      `id, receipt_no, student_id, amount, method, txn_id, paid_on, note, collected_by_name,
       cancelled_at, cancel_reason, created_at,
       student:students(${ENROLLED}),
       lines:payment_allocations(amount, item:invoice_items(period_key, is_fine,
         invoice:invoices(id, invoice_no, session_id, total, paid, status), head:fee_heads(name_en, name_bn)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const periodName = await periodNamer(db, lang);
  const lines = p.lines as unknown as {
    amount: number;
    item: {
      period_key: string;
      is_fine: boolean;
      invoice: {
        id: number;
        invoice_no: string;
        session_id: number;
        total: number;
        paid: number;
        status: string;
      };
      head: Named;
    };
  }[];
  const st = found(
    p.student as unknown as RawEnrolled,
    lines[0]?.item.invoice.session_id ?? null,
    lang,
  );
  return {
    id: p.id,
    receiptNo: p.receipt_no,
    studentId: p.student_id,
    studentCode: st.code,
    student: st.name,
    section: st.section,
    roll: st.roll,
    amount: p.amount,
    method: p.method,
    txnId: p.txn_id,
    paidOn: p.paid_on,
    note: p.note,
    collectedBy: p.collected_by_name,
    dueNow: [
      ...new Map(
        lines.map((l) => [l.item.invoice.id, l.item.invoice]),
      ).values(),
    ]
      .filter((i) => i.status !== "cancelled")
      .reduce((sum, i) => sum + i.total - i.paid, 0),
    cancelled: p.cancelled_at
      ? { at: p.cancelled_at, reason: p.cancel_reason ?? "" }
      : null,
    lines: lines
      .sort(
        (a, b) =>
          a.item.invoice.invoice_no.localeCompare(b.item.invoice.invoice_no) ||
          Number(b.item.is_fine) - Number(a.item.is_fine),
      )
      .map((l) => ({
        invoiceNo: l.item.invoice.invoice_no,
        head: pickLocalized(l.item.head, "name", lang),
        period: l.item.is_fine ? "" : periodName(l.item.period_key),
        amount: l.amount,
      })),
  };
}

export type PaymentRow = {
  id: number;
  receiptNo: string;
  paidOn: string;
  amount: number;
  method: AnyPaymentMethod;
  cancelled: boolean;
};

/** A student's payments, newest first. */
export async function studentPayments(
  db: Client,
  studentId: number,
): Promise<PaymentRow[]> {
  const { data } = await db
    .from("payments")
    .select("id, receipt_no, paid_on, amount, method, cancelled_at")
    .eq("student_id", studentId)
    .order("id", { ascending: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    receiptNo: p.receipt_no,
    paidOn: p.paid_on,
    amount: p.amount,
    method: p.method,
    cancelled: p.cancelled_at !== null,
  }));
}

export type StudentInvoice = {
  id: number;
  invoiceNo: string;
  periods: string[];
  dueOn: string;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  total: number;
  paid: number;
  /** Late fine owed today but not yet on the invoice. */
  fine: number;
};

/** A student's invoices (newest first) with the live late fine, for the portal. */
export async function studentInvoices(
  db: Client,
  studentId: number,
  rule: FineRule,
  lang: Locale,
): Promise<StudentInvoice[]> {
  const [{ data }, periodName] = await Promise.all([
    db
      .from("invoices")
      .select(
        "id, invoice_no, due_on, status, total, paid, items:invoice_items(period_key, is_fine)",
      )
      .eq("student_id", studentId)
      .order("due_on", { ascending: false })
      .order("id", { ascending: false }),
    periodNamer(db, lang),
  ]);
  const today = dhakaToday();
  return (data ?? []).map((i) => {
    const items = i.items as { period_key: string; is_fine: boolean }[];
    const open = i.status === "unpaid" || i.status === "partial";
    return {
      id: i.id,
      invoiceNo: i.invoice_no,
      periods: [
        ...new Set(
          items.filter((x) => !x.is_fine).map((x) => periodName(x.period_key)),
        ),
      ],
      dueOn: i.due_on,
      status: i.status,
      total: i.total,
      paid: i.paid,
      fine:
        open && !items.some((x) => x.is_fine)
          ? lateFine(rule, i.due_on, today, i.total - i.paid)
          : 0,
    };
  });
}
