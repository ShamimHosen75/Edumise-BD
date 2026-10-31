import "server-only";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { monthBounds, totalsBy, type AnyPaymentMethod } from "@/lib/collection";
import { lateFine, type FineRule } from "@/lib/fees";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import { dhakaToday } from "@/lib/people";
import { receiverText } from "@/lib/receipt-text";
import { totalsRow, type CellKind, type Report } from "@/lib/report-table";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type Named = { name_en: string; name_bn: string };

type PaymentRaw = {
  receipt_no: string;
  amount: number;
  method: AnyPaymentMethod;
  txn_id: string | null;
  collected_by_name: string;
  collected_by_name_bn: string;
  gateway: string | null;
  gateway_txn_id: string | null;
  cancelled_at: string | null;
  student: { student_code: string } & {
    full_name_en: string;
    full_name_bn: string;
  };
};

/** Collection of one day: every receipt, then totals by method and by collector. */
export async function dailyReport(
  db: Client,
  day: string,
  lang: Locale,
  dict: Dictionary,
): Promise<Report> {
  const r = dict.fees.reports;
  const rows = await fetchAll<PaymentRaw>(
    (a, b) =>
      db
        .from("payments")
        .select(
          "receipt_no, amount, method, txn_id, collected_by_name, collected_by_name_bn, gateway, gateway_txn_id, cancelled_at, student:students(student_code, full_name_en, full_name_bn)",
        )
        .eq("paid_on", day)
        .order("id")
        .range(a, b) as never,
  );
  const active = rows.filter((p) => !p.cancelled_at);
  // The receiver in the reader's language, or the online gateway.
  const receiver = (p: PaymentRaw) =>
    receiverText(
      {
        collectedBy:
          (lang === "bn" && p.collected_by_name_bn) || p.collected_by_name,
        gateway: p.gateway,
      },
      dict,
    );
  const kinds: CellKind[] = ["text", "text", "text", "text", "money", "text"];
  const list = rows.map((p) => [
    p.receipt_no,
    `${pickLocalized(p.student, "full_name", lang)} (${localizeDigits(p.student.student_code, lang)})`,
    `${dict.fees.methods[p.method]}${(p.gateway_txn_id ?? p.txn_id) ? ` · ${p.gateway_txn_id ?? p.txn_id}` : ""}`,
    receiver(p),
    p.cancelled_at ? 0 : p.amount,
    p.cancelled_at ? dict.fees.receipt.cancelled : "",
  ]);
  const sumKinds: CellKind[] = ["text", "number", "money"];
  const by = (key: (p: PaymentRaw) => string) =>
    totalsBy(active, key, (p) => p.amount).map((x) => [
      x.key,
      x.count,
      x.amount,
    ]);
  const byMethod = by((p) => dict.fees.methods[p.method]);
  const byCollector = by(receiver);
  return {
    title: r.daily.title,
    subtitle: formatDate(day, lang, "long"),
    tables: [
      {
        caption: r.daily.receipts,
        head: [
          r.receiptNo,
          r.student,
          r.method,
          r.collector,
          r.amount,
          r.status,
        ],
        kinds,
        rows: list,
        foot: totalsRow(r.total, kinds, list),
      },
      {
        caption: r.daily.byMethod,
        head: [r.method, r.count, r.amount],
        kinds: sumKinds,
        rows: byMethod,
        foot: totalsRow(r.total, sumKinds, byMethod),
      },
      {
        caption: r.daily.byCollector,
        head: [r.collector, r.count, r.amount],
        kinds: sumKinds,
        rows: byCollector,
        foot: totalsRow(r.total, sumKinds, byCollector),
      },
    ],
  };
}

/** Income by fee head for payments (not cancelled) between two dates. */
export async function incomeReport(
  db: Client,
  from: string,
  to: string,
  lang: Locale,
  dict: Dictionary,
): Promise<Report> {
  const r = dict.fees.reports;
  const rows = await fetchAll<{
    amount: number;
    item: { head: Named & { sort_order: number } };
  }>(
    (a, b) =>
      db
        .from("payment_allocations")
        .select(
          "amount, payment:payments!inner(paid_on, cancelled_at), item:invoice_items(head:fee_heads(name_en, name_bn, sort_order))",
        )
        .gte("payment.paid_on", from)
        .lte("payment.paid_on", to)
        .is("payment.cancelled_at", null)
        .order("id")
        .range(a, b) as never,
  );
  const kinds: CellKind[] = ["text", "number", "money"];
  const order = new Map(
    rows.map((x) => [
      pickLocalized(x.item.head, "name", lang),
      x.item.head.sort_order,
    ]),
  );
  const list = totalsBy(
    rows,
    (x) => pickLocalized(x.item.head, "name", lang),
    (x) => x.amount,
  )
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
    .map((x) => [x.key, x.count, x.amount]);
  return {
    title: r.income.title,
    subtitle: t(dict, "fees.reports.range", {
      from: formatDate(from, lang, "medium"),
      to: formatDate(to, lang, "medium"),
    }),
    tables: [
      {
        caption: r.income.byHead,
        head: [r.head, r.count, r.amount],
        kinds,
        rows: list,
        foot: totalsRow(r.total, kinds, list),
      },
    ],
  };
}

export type CollectionSummary = {
  today: number;
  month: number;
  lastMonth: number;
  topDues: { id: number; name: string; amount: number }[];
};

/** The accountant's home: today, this month, last month, and who owes most. */
export async function collectionSummary(
  db: Client,
  rule: FineRule,
  lang: Locale,
): Promise<CollectionSummary> {
  const today = dhakaToday();
  const m = monthBounds(today);
  const [paid, open] = await Promise.all([
    fetchAll<{ amount: number; paid_on: string }>(
      (a, b) =>
        db
          .from("payments")
          .select("amount, paid_on")
          .gte("paid_on", m.lastFrom)
          .lte("paid_on", today)
          .is("cancelled_at", null)
          .order("id")
          .range(a, b) as never,
    ),
    fetchAll<{
      student_id: number;
      due_on: string;
      total: number;
      paid: number;
      items: { is_fine: boolean }[];
      session: { is_current: boolean };
      student: Named & { full_name_en: string; full_name_bn: string };
    }>(
      (a, b) =>
        db
          .from("invoices")
          .select(
            "student_id, due_on, total, paid, items:invoice_items(is_fine), session:academic_sessions!inner(is_current), student:students(full_name_en, full_name_bn)",
          )
          .in("status", ["unpaid", "partial"])
          .eq("session.is_current", true)
          .order("id")
          .range(a, b) as never,
    ),
  ]);
  const sum = (from: string, to: string) =>
    paid
      .filter((p) => p.paid_on >= from && p.paid_on <= to)
      .reduce((s, p) => s + p.amount, 0);
  const names = new Map(
    open.map((i) => [
      i.student_id,
      pickLocalized(i.student, "full_name", lang),
    ]),
  );
  return {
    today: sum(today, today),
    month: sum(m.from, today),
    lastMonth: sum(m.lastFrom, m.lastTo),
    topDues: totalsBy(
      open,
      (i) => String(i.student_id),
      // As on the dues report: what is owed plus today's late fine not yet charged.
      (i) =>
        i.total -
        i.paid +
        (i.items.some((x) => x.is_fine)
          ? 0
          : lateFine(rule, i.due_on, today, i.total - i.paid)),
    )
      .slice(0, 5)
      .map((x) => ({
        id: Number(x.key),
        name: names.get(Number(x.key)) ?? "",
        amount: x.amount,
      })),
  };
}
