// Fee collection (pure, unit tested): payment methods, allocation and the ledger.
//
// Allocation (open question 40): the accountant ticks the items to pay; the amount goes
// to the oldest due date first, and within an invoice the late fine before the fees.
// The database function record_payment() uses the same order.

import { toAsciiDigits } from "@/lib/format";

export const PAYMENT_METHODS = [
  "cash",
  "bkash",
  "nagad",
  "rocket",
  "bank",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Mobile banking needs the transaction ID (unique per method, open question 42). */
export const needsTxn = (m: PaymentMethod) =>
  m === "bkash" || m === "nagad" || m === "rocket";

/** A transaction ID as typed: letters, digits and dashes, 4–40 long; null if not one. */
export function readTxn(text: string): string | null {
  const v = toAsciiDigits(text).trim().toUpperCase();
  return /^[A-Z0-9-]{4,40}$/.test(v) ? v : null;
}

export type DueItem = {
  id: number;
  invoiceId: number;
  dueOn: string;
  isFine: boolean;
  outstanding: number;
};

/** Payment order: oldest due date first; in an invoice the fine first; then by id. */
export function payOrder<T extends Omit<DueItem, "outstanding">>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      a.dueOn.localeCompare(b.dueOn) ||
      a.invoiceId - b.invoiceId ||
      Number(b.isFine) - Number(a.isFine) ||
      a.id - b.id,
  );
}

/** The items a payment covers: the ticked ones and the late fine of each of their invoices. */
export function inPlay<T extends Pick<DueItem, "id" | "invoiceId" | "isFine">>(
  items: readonly T[],
  ticked: ReadonlySet<number>,
): T[] {
  const invoices = new Set(
    items.filter((i) => ticked.has(i.id)).map((i) => i.invoiceId),
  );
  return items.filter(
    (i) => ticked.has(i.id) || (i.isFine && invoices.has(i.invoiceId)),
  );
}

export type Allocation =
  | { ok: true; lines: { id: number; amount: number }[] }
  | { ok: false; reason: "zero" | "over" };

/** Spreads a payment over the ticked items. More than they owe is refused. */
export function allocate(
  amount: number,
  items: readonly DueItem[],
): Allocation {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    return { ok: false, reason: "zero" };
  const owed = items.reduce((s, i) => s + Math.max(0, i.outstanding), 0);
  if (amount > owed) return { ok: false, reason: "over" };
  let left = amount;
  const lines: { id: number; amount: number }[] = [];
  for (const item of payOrder(items)) {
    if (left === 0) break;
    const take = Math.min(left, Math.max(0, item.outstanding));
    if (take > 0) {
      lines.push({ id: item.id, amount: take });
      left -= take;
    }
  }
  return { ok: true, lines };
}

export type LedgerEntry = {
  date: string;
  kind: "invoice" | "payment";
  ref: string;
  amount: number;
  cancelled: boolean;
};

export type LedgerRow = LedgerEntry & {
  debit: number;
  credit: number;
  balance: number;
};

/**
 * A student's ledger: invoices are debits, payments credits, in date order (an invoice
 * before a payment on the same day). Cancelled entries are listed but count as 0.
 */
export function ledger(entries: readonly LedgerEntry[]): LedgerRow[] {
  let balance = 0;
  return [...entries]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.kind === b.kind ? 0 : a.kind === "invoice" ? -1 : 1) ||
        a.ref.localeCompare(b.ref),
    )
    .map((e) => {
      const value = e.cancelled ? 0 : e.amount;
      const debit = e.kind === "invoice" ? value : 0;
      const credit = e.kind === "payment" ? value : 0;
      balance += debit - credit;
      return { ...e, debit, credit, balance };
    });
}

/** Sums by a key (method, collector, fee head), largest first. */
export function totalsBy<T>(
  rows: readonly T[],
  key: (r: T) => string,
  amount: (r: T) => number,
) {
  const map = new Map<string, { key: string; count: number; amount: number }>();
  for (const r of rows) {
    const k = key(r);
    const have = map.get(k) ?? { key: k, count: 0, amount: 0 };
    have.count++;
    have.amount += amount(r);
    map.set(k, have);
  }
  return [...map.values()].sort(
    (a, b) => b.amount - a.amount || a.key.localeCompare(b.key),
  );
}

/** First and last day of the month of a date, and of the month before. */
export function monthBounds(day: string) {
  const [y, m] = day.split("-").map(Number) as [number, number];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(new Date(Date.UTC(y, m - 1, 1))),
    to: iso(new Date(Date.UTC(y, m, 0))),
    lastFrom: iso(new Date(Date.UTC(y, m - 2, 1))),
    lastTo: iso(new Date(Date.UTC(y, m - 1, 0))),
  };
}
