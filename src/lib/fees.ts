// Fees (pure, unit tested). All money is whole poisha (BDT × 100) as integers.
//
// - Waivers (open questions 37, 38): percent waivers are added up (at most 100%) and
//   taken from the gross amount, rounded down to the whole poisha, so the school never
//   under-charges by rounding; then fixed waivers. The net is never below 0.
// - A group's amount (Classes 9–10) replaces the class amount for that group.
// - Late fine (open question 39): worked out live from the due date; Step 5.2 freezes it
//   onto the invoice when a payment is recorded.

import { toAsciiDigits } from "@/lib/format";

export const FEE_FREQUENCIES = ["monthly", "one_time"] as const;
export type FeeFrequency = (typeof FEE_FREQUENCIES)[number];

/** "1,234.50" or "১২৩৪.৫" (taka, up to 2 decimals) -> poisha; null if not a sum of money. */
export function toPoisha(text: string): number | null {
  const v = toAsciiDigits(text).trim().replace(/,/g, "").replace(/^৳\s*/, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) return null;
  const [taka, fraction = ""] = v.split(".");
  return Number(taka) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Poisha -> "1234.50" for a form field ("" for null). */
export const toTakaText = (poisha: number | null) =>
  poisha === null
    ? ""
    : `${Math.floor(poisha / 100)}${poisha % 100 ? `.${String(poisha % 100).padStart(2, "0")}` : ""}`;

export type Waiver = { kind: "percent" | "fixed"; value: number };

/** The waiver (poisha) on a gross amount: percents first (rounded down), then fixed. */
export function waiverAmount(
  gross: number,
  waivers: readonly Waiver[],
): number {
  assertMoney(gross);
  const percent = Math.min(
    100,
    waivers
      .filter((w) => w.kind === "percent")
      .reduce((s, w) => s + w.value, 0),
  );
  const fixed = waivers
    .filter((w) => w.kind === "fixed")
    .reduce((s, w) => s + w.value, 0);
  const byPercent = Math.floor((gross * percent) / 100);
  return Math.min(gross, byPercent + fixed);
}

export type Structure = {
  classId: number;
  groupId: number | null;
  feeHeadId: number;
  amount: number;
};

/** The amount a student is charged for a head: their group's row, else the class row. */
export function amountFor(
  structures: readonly Structure[],
  classId: number,
  groupId: number | null,
  feeHeadId: number,
): number | null {
  const rows = structures.filter(
    (s) => s.classId === classId && s.feeHeadId === feeHeadId,
  );
  const own =
    groupId !== null ? rows.find((s) => s.groupId === groupId) : undefined;
  return (own ?? rows.find((s) => s.groupId === null))?.amount ?? null;
}

export type Line = { gross: number; waiver: number };

/** Totals of an invoice's items. */
export function totals(items: readonly Line[]) {
  const gross = items.reduce((s, i) => s + i.gross, 0);
  const waiver = items.reduce((s, i) => s + i.waiver, 0);
  return { gross, waiver, net: gross - waiver };
}

export type FineRule = {
  /** Poisha per day after the due date (and the grace days); 0 = no fine. */
  perDay: number;
  /** Largest fine per invoice (poisha); 0 = no limit. */
  cap: number;
  graceDays: number;
};

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** Late fine for one invoice today (dates as YYYY-MM-DD, Dhaka). */
export function lateFine(
  rule: FineRule,
  dueOn: string,
  today: string,
  outstanding: number,
): number {
  if (rule.perDay <= 0 || outstanding <= 0) return 0;
  const days = dayNumber(today) - dayNumber(dueOn) - rule.graceDays;
  if (!(days > 0)) return 0;
  const fine = days * rule.perDay;
  return rule.cap > 0 ? Math.min(rule.cap, fine) : fine;
}

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "cancelled";

/** Status from what is owed and paid. Paying more than the total is refused. */
export function invoiceStatus(
  total: number,
  paid: number,
  cancelled = false,
): InvoiceStatus {
  assertMoney(total);
  assertMoney(paid);
  if (paid > total) throw new Error("Overpayment");
  if (cancelled) return "cancelled";
  if (paid === total) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

/** A payment must be more than 0 and at most what is still owed. */
export function checkPayment(
  amount: number,
  outstanding: number,
): "ok" | "zero" | "over" {
  if (!Number.isInteger(amount) || amount <= 0) return "zero";
  return amount > outstanding ? "over" : "ok";
}

function assertMoney(v: number) {
  if (!Number.isSafeInteger(v) || v < 0)
    throw new Error("Money must be whole poisha");
}

/** Period keys: "2026-10" for a monthly head; "session:3" or "exam:12" for one-time. */
export const monthKey = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
  return month;
};
export const oneTimeKey = (sessionId: number, examId: number | null) =>
  examId ? `exam:${examId}` : `session:${sessionId}`;

export type Billable = {
  studentId: number;
  classId: number;
  groupId: number | null;
};

export type PlannedInvoice = {
  studentId: number;
  items: { feeHeadId: number; gross: number; waiver: number }[];
  net: number;
};

/**
 * Invoices for one period: an item per head with an amount for the student's class or
 * group, after the student's (approved) waivers. Items already billed for that
 * student, head and period are skipped, so running it twice adds nothing.
 */
export function planInvoices(input: {
  students: readonly Billable[];
  feeHeadIds: readonly number[];
  structures: readonly Structure[];
  /** student id -> head id -> waivers */
  waivers: ReadonlyMap<number, ReadonlyMap<number, readonly Waiver[]>>;
  /** "studentId:headId" already billed for this period */
  billed: ReadonlySet<string>;
}): { invoices: PlannedInvoice[]; skipped: number } {
  let skipped = 0;
  const invoices: PlannedInvoice[] = [];
  for (const st of input.students) {
    const items: PlannedInvoice["items"] = [];
    for (const head of input.feeHeadIds) {
      const gross = amountFor(input.structures, st.classId, st.groupId, head);
      if (gross === null) continue;
      if (input.billed.has(`${st.studentId}:${head}`)) {
        skipped++;
        continue;
      }
      const waiver = waiverAmount(
        gross,
        input.waivers.get(st.studentId)?.get(head) ?? [],
      );
      items.push({ feeHeadId: head, gross, waiver });
    }
    if (items.length)
      invoices.push({ studentId: st.studentId, items, net: totals(items).net });
  }
  return { invoices, skipped };
}

/** Preview numbers: invoices, their total and how many items were already billed. */
export function planSummary(plan: ReturnType<typeof planInvoices>) {
  return {
    invoices: plan.invoices.length,
    total: plan.invoices.reduce((s, i) => s + i.net, 0),
    waived: plan.invoices.reduce(
      (s, i) => s + i.items.reduce((t, x) => t + x.waiver, 0),
      0,
    ),
    skipped: plan.skipped,
  };
}

export type Period =
  { kind: "month"; month: string } | { kind: "session" | "exam"; id: number };

/** Reads a period key back ("2026-10", "session:3", "exam:12"); null if it is neither. */
export function parsePeriod(key: string): Period | null {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return { kind: "month", month: key };
  const m = /^(session|exam):([1-9]\d{0,15})$/.exec(key);
  return m ? { kind: m[1] as "session" | "exam", id: Number(m[2]) } : null;
}
