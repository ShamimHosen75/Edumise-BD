import "server-only";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ledger } from "@/lib/collection";
import { lateFine, type FineRule } from "@/lib/fees";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";

/** The Dhaka date (YYYY-MM-DD) of a timestamp. */
const dhakaDate = (ts: string) =>
  new Date(Date.parse(ts) + 6 * 3600_000).toISOString().slice(0, 10);
import { totalsRow, type CellKind, type Report } from "@/lib/report-table";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

export type DuesFilter = {
  sessionId: number;
  classId?: number;
  sectionId?: number;
  /** "2026-10": only invoices that bill this period. */
  period?: string;
};

type OpenInvoice = {
  student_id: number;
  due_on: string;
  total: number;
  paid: number;
  items: { period_key: string; is_fine: boolean }[];
  student: Named & {
    student_code: string;
    full_name_en: string;
    full_name_bn: string;
    enrollments: {
      session_id: number;
      roll: number;
      section_id: number;
      section: Named & { class_id: number; class: Named & { level: number } };
    }[];
    guardians: { is_primary: boolean; guardian: { phone: string } }[];
  };
};

/**
 * Who owes what: one row per student with open invoices (with today's late fine), by
 * class, section and roll, with the primary guardian's phone (staff only).
 */
export async function duesReport(
  db: Client,
  f: DuesFilter,
  rule: FineRule,
  lang: Locale,
  dict: Dictionary,
  subtitle: string,
): Promise<Report> {
  const r = dict.fees.reports;
  const invoices = await fetchAll<OpenInvoice>(
    (a, b) =>
      db
        .from("invoices")
        .select(
          `student_id, due_on, total, paid, items:invoice_items(period_key, is_fine),
         student:students(student_code, full_name_en, full_name_bn,
           enrollments(session_id, roll, section_id, section:sections(class_id, name_en, name_bn, class:classes(name_en, name_bn, level))),
           guardians:student_guardians(is_primary, guardian:guardians(phone)))`,
        )
        .eq("session_id", f.sessionId)
        .in("status", ["unpaid", "partial"])
        .order("id")
        .range(a, b) as never,
  );
  const today = dhakaToday();
  const byStudent = new Map<
    number,
    { inv: OpenInvoice; count: number; due: number }
  >();
  for (const inv of invoices) {
    const en = inv.student.enrollments.find(
      (e) => e.session_id === f.sessionId,
    );
    if (f.classId && en?.section.class_id !== f.classId) continue;
    if (f.sectionId && en?.section_id !== f.sectionId) continue;
    if (f.period && !inv.items.some((i) => i.period_key === f.period)) continue;
    const fine = inv.items.some((i) => i.is_fine)
      ? 0
      : lateFine(rule, inv.due_on, today, inv.total - inv.paid);
    const have = byStudent.get(inv.student_id) ?? { inv, count: 0, due: 0 };
    have.count++;
    have.due += inv.total - inv.paid + fine;
    byStudent.set(inv.student_id, have);
  }
  const kinds: CellKind[] = [
    "text",
    "text",
    "text",
    "number",
    "text",
    "number",
    "money",
  ];
  const sorted = [...byStudent.values()].map(({ inv, count, due }) => {
    const st = inv.student;
    const en = st.enrollments.find((e) => e.session_id === f.sessionId);
    const phone =
      (st.guardians.find((g) => g.is_primary) ?? st.guardians[0])?.guardian
        .phone ?? "";
    return {
      key: [
        en?.section.class.level ?? 99,
        en?.section.name_en ?? "",
        en?.roll ?? 999,
      ] as const,
      row: [
        localizeDigits(st.student_code, lang),
        pickLocalized(st, "full_name", lang),
        en
          ? `${pickLocalized(en.section.class, "name", lang)} ${pickLocalized(en.section, "name", lang)}`
          : "",
        en?.roll ?? "",
        localizeDigits(phone, lang),
        count,
        due,
      ],
    };
  });
  sorted.sort(
    (a, b) =>
      a.key[0] - b.key[0] ||
      a.key[1].localeCompare(b.key[1]) ||
      a.key[2] - b.key[2],
  );
  const rows = sorted.map((x) => x.row);
  return {
    title: r.dues.title,
    subtitle,
    tables: [
      {
        caption: r.dues.list,
        head: [
          r.studentId,
          r.student,
          r.class,
          r.roll,
          r.phone,
          r.invoices,
          r.due,
        ],
        kinds,
        rows,
        foot: totalsRow(r.total, kinds, rows),
      },
    ],
  };
}

/** A student's ledger: invoices (debit) and receipts (credit) with a running balance. */
export async function ledgerReport(
  db: Client,
  studentId: number,
  lang: Locale,
  dict: Dictionary,
): Promise<Report | null> {
  const r = dict.fees.reports;
  const [
    { data: st },
    { data: invoices },
    { data: payments },
    { data: fines },
  ] = await Promise.all([
    db
      .from("students")
      .select("student_code, full_name_en, full_name_bn")
      .eq("id", studentId)
      .maybeSingle(),
    db
      .from("invoices")
      .select("invoice_no, issued_on, total, status")
      .eq("student_id", studentId),
    db
      .from("payments")
      .select("receipt_no, paid_on, amount, cancelled_at")
      .eq("student_id", studentId),
    db
      .from("invoice_items")
      .select("gross, created_at, invoice:invoices(invoice_no, status)")
      .eq("student_id", studentId)
      .eq("is_fine", true),
  ]);
  if (!st) return null;
  // A late fine is charged on the day it was frozen, not on the bill's date: the
  // balances of the days before stay as they were.
  const fineRows = (fines ?? []).map((f) => {
    const inv = f.invoice as unknown as { invoice_no: string; status: string };
    return {
      date: dhakaDate(f.created_at),
      kind: "invoice" as const,
      ref: `${inv.invoice_no} · ${dict.fees.invoices.fine}`,
      invoiceNo: inv.invoice_no,
      amount: f.gross,
      cancelled: inv.status === "cancelled",
    };
  });
  const fineOf = (no: string) =>
    fineRows
      .filter((f) => f.invoiceNo === no)
      .reduce((s, f) => s + f.amount, 0);
  const rows = ledger([
    ...(invoices ?? []).map((i) => ({
      date: i.issued_on,
      kind: "invoice" as const,
      ref: i.invoice_no,
      amount: i.total - fineOf(i.invoice_no),
      cancelled: i.status === "cancelled",
    })),
    ...fineRows.map((f) => ({
      date: f.date,
      kind: f.kind,
      ref: f.ref,
      amount: f.amount,
      cancelled: f.cancelled,
    })),
    ...(payments ?? []).map((p) => ({
      date: p.paid_on,
      kind: "payment" as const,
      ref: p.receipt_no,
      amount: p.amount,
      cancelled: p.cancelled_at !== null,
    })),
  ]);
  const kinds: CellKind[] = ["text", "text", "text", "money", "money", "money"];
  const list = rows.map((x) => [
    formatDate(x.date, lang, "medium"),
    x.kind === "invoice" ? r.ledger.invoice : r.ledger.receipt,
    x.cancelled ? `${x.ref} (${dict.fees.receipt.cancelled})` : x.ref,
    x.debit,
    x.credit,
    x.balance,
  ]);
  const foot = totalsRow(r.total, kinds, list);
  foot[5] = rows.at(-1)?.balance ?? 0;
  return {
    title: r.ledger.title,
    subtitle: `${pickLocalized(st, "full_name", lang)} (${localizeDigits(st.student_code, lang)})`,
    tables: [
      {
        caption: r.ledger.entries,
        head: [
          r.date,
          r.ledger.kind,
          r.ledger.ref,
          r.ledger.debit,
          r.ledger.credit,
          r.ledger.balance,
        ],
        kinds,
        rows: list,
        foot,
      },
    ],
  };
}
