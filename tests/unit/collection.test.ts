import { describe, expect, it } from "vitest";

import { amountInWordsBn, amountInWordsEn } from "@/lib/amount-words";
import { cellText, reportSheet, totalsRow } from "@/lib/report-table";
import {
  allocate,
  inPlay,
  ledger,
  monthBounds,
  needsTxn,
  payOrder,
  readTxn,
  totalsBy,
  type DueItem,
} from "@/lib/collection";

const item = (o: Partial<DueItem> & { id: number }): DueItem => ({
  invoiceId: 1,
  dueOn: "2026-10-15",
  isFine: false,
  outstanding: 60000,
  ...o,
});

describe("payment methods", () => {
  it("mobile banking needs a transaction ID", () => {
    expect(needsTxn("bkash")).toBe(true);
    expect(needsTxn("nagad")).toBe(true);
    expect(needsTxn("rocket")).toBe(true);
    expect(needsTxn("cash")).toBe(false);
    expect(needsTxn("bank")).toBe(false);
  });
  it("reads transaction IDs", () => {
    expect(readTxn(" bk7q2m9xa4 ")).toBe("BK7Q2M9XA4");
    expect(readTxn("৯৮৭৬৫")).toBe("98765");
    expect(readTxn("abc")).toBeNull();
    expect(readTxn("bad id!")).toBeNull();
    expect(readTxn("x".repeat(41))).toBeNull();
  });
});

describe("allocation (Q40)", () => {
  const items = [
    item({ id: 3, invoiceId: 2, dueOn: "2026-11-15" }),
    item({ id: 1, invoiceId: 1, dueOn: "2026-10-15", outstanding: 30000 }),
    item({
      id: 9,
      invoiceId: 1,
      dueOn: "2026-10-15",
      isFine: true,
      outstanding: 5000,
    }),
    item({ id: 2, invoiceId: 1, dueOn: "2026-10-15", outstanding: 5000 }),
  ];
  it("pays the oldest invoice first, its fine before its fees", () => {
    expect(payOrder(items).map((i) => i.id)).toEqual([9, 1, 2, 3]);
  });
  it("spreads a partial payment in that order", () => {
    expect(allocate(36000, items)).toEqual({
      ok: true,
      lines: [
        { id: 9, amount: 5000 },
        { id: 1, amount: 30000 },
        { id: 2, amount: 1000 },
      ],
    });
  });
  it("pays everything exactly", () => {
    const r = allocate(100000, items);
    expect(r.ok && r.lines.reduce((s, l) => s + l.amount, 0)).toBe(100000);
  });
  it("refuses overpayment and zero", () => {
    expect(allocate(100001, items)).toEqual({ ok: false, reason: "over" });
    expect(allocate(0, items)).toEqual({ ok: false, reason: "zero" });
    expect(allocate(-5, items)).toEqual({ ok: false, reason: "zero" });
    expect(allocate(10.5, items)).toEqual({ ok: false, reason: "zero" });
    expect(allocate(1, [])).toEqual({ ok: false, reason: "over" });
  });
  it("a fine comes with any ticked item of its invoice", () => {
    const ids = (t: number[]) => inPlay(items, new Set(t)).map((i) => i.id);
    expect(ids([1])).toEqual([1, 9]);
    expect(ids([3])).toEqual([3]);
    expect(ids([])).toEqual([]);
    expect(ids([9])).toEqual([9]);
  });
  it("skips items already paid", () => {
    expect(
      allocate(100, [
        item({ id: 1, outstanding: 0 }),
        item({ id: 2, outstanding: 100 }),
      ]),
    ).toEqual({
      ok: true,
      lines: [{ id: 2, amount: 100 }],
    });
  });
});

describe("student ledger", () => {
  it("runs a balance: invoices debit, payments credit, cancelled count 0", () => {
    const rows = ledger([
      {
        date: "2026-10-20",
        kind: "payment",
        ref: "RCP-2026-000002",
        amount: 20000,
        cancelled: true,
      },
      {
        date: "2026-10-05",
        kind: "payment",
        ref: "RCP-2026-000001",
        amount: 40000,
        cancelled: false,
      },
      {
        date: "2026-10-01",
        kind: "invoice",
        ref: "INV-2026-000001",
        amount: 60000,
        cancelled: false,
      },
      {
        date: "2026-11-01",
        kind: "invoice",
        ref: "INV-2026-000005",
        amount: 60000,
        cancelled: false,
      },
      {
        date: "2026-11-01",
        kind: "payment",
        ref: "RCP-2026-000003",
        amount: 80000,
        cancelled: false,
      },
    ]);
    expect(rows.map((r) => [r.ref, r.debit, r.credit, r.balance])).toEqual([
      ["INV-2026-000001", 60000, 0, 60000],
      ["RCP-2026-000001", 0, 40000, 20000],
      ["RCP-2026-000002", 0, 0, 20000],
      ["INV-2026-000005", 60000, 0, 80000],
      ["RCP-2026-000003", 0, 80000, 0],
    ]);
  });
  it("is empty without entries", () => {
    expect(ledger([])).toEqual([]);
  });
});

describe("totals by key", () => {
  it("adds up and sorts by amount", () => {
    const rows = [
      { m: "cash", a: 100 },
      { m: "bkash", a: 500 },
      { m: "cash", a: 200 },
    ];
    expect(
      totalsBy(
        rows,
        (r) => r.m,
        (r) => r.a,
      ),
    ).toEqual([
      { key: "bkash", count: 1, amount: 500 },
      { key: "cash", count: 2, amount: 300 },
    ]);
  });
});

describe("amount in words", () => {
  it("English, with lakh and crore", () => {
    expect(amountInWordsEn(0)).toBe("Zero taka only");
    expect(amountInWordsEn(100)).toBe("One taka only");
    expect(amountInWordsEn(1500)).toBe("Fifteen taka only");
    expect(amountInWordsEn(60000)).toBe("Six hundred taka only");
    expect(amountInWordsEn(125050)).toBe(
      "One thousand two hundred fifty taka and fifty poisha only",
    );
    expect(amountInWordsEn(9999999)).toBe(
      "Ninety-nine thousand nine hundred ninety-nine taka and ninety-nine poisha only",
    );
    expect(amountInWordsEn(12345600)).toBe(
      "One lakh twenty-three thousand four hundred fifty-six taka only",
    );
    expect(amountInWordsEn(150000000000)).toBe(
      "One hundred fifty crore taka only",
    );
    expect(amountInWordsEn(5)).toBe("Zero taka and five poisha only");
  });
  it("Bangla, every number 0–99 has its own word", () => {
    expect(amountInWordsBn(0)).toBe("শূন্য টাকা মাত্র");
    expect(amountInWordsBn(60000)).toBe("ছয় শত টাকা মাত্র");
    expect(amountInWordsBn(125050)).toBe(
      "এক হাজার দুই শত পঞ্চাশ টাকা পঞ্চাশ পয়সা মাত্র",
    );
    expect(amountInWordsBn(4700)).toBe("সাতচল্লিশ টাকা মাত্র");
    expect(amountInWordsBn(9900)).toBe("নিরানব্বই টাকা মাত্র");
    expect(amountInWordsBn(12345600)).toBe(
      "এক লক্ষ তেইশ হাজার চার শত ছাপ্পান্ন টাকা মাত্র",
    );
    expect(amountInWordsBn(250000000000)).toBe("দুই শত পঞ্চাশ কোটি টাকা মাত্র");
  });
  it("refuses amounts that are not whole poisha", () => {
    expect(() => amountInWordsEn(1.5)).toThrow();
    expect(() => amountInWordsBn(-1)).toThrow();
  });
});

describe("month bounds", () => {
  it("this month and the one before, across a year", () => {
    expect(monthBounds("2026-10-29")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      lastFrom: "2026-09-01",
      lastTo: "2026-09-30",
    });
    expect(monthBounds("2026-01-05")).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
      lastFrom: "2025-12-01",
      lastTo: "2025-12-31",
    });
    expect(monthBounds("2028-03-01").lastTo).toBe("2028-02-29");
  });
});

describe("report tables", () => {
  const kinds = ["text", "number", "money"] as const;
  const rows = [
    ["Cash", 2, 50000],
    ["bKash", 1, 20050],
  ];
  it("adds up money columns only", () => {
    expect(totalsRow("Total", [...kinds], rows)).toEqual(["Total", "", 70050]);
  });
  it("formats cells by kind", () => {
    const money = (p: number) => `৳${p / 100}`;
    expect(cellText(20050, "money", money, String)).toBe("৳200.5");
    expect(cellText(3, "number", money, String)).toBe("3");
    expect(cellText("x", "money", money, String)).toBe("x");
  });
  it("makes one Excel sheet with money in taka", () => {
    expect(
      reportSheet({
        title: "Daily",
        subtitle: "29 Oct",
        tables: [
          {
            caption: "By method",
            head: ["Method", "Count", "Amount"],
            kinds: [...kinds],
            rows,
            foot: ["Total", "", 70050],
          },
        ],
      }),
    ).toEqual([
      ["Daily"],
      ["29 Oct"],
      [],
      ["By method"],
      ["Method", "Count", "Amount"],
      ["Cash", 2, 500],
      ["bKash", 1, 200.5],
      ["Total", "", 700.5],
    ]);
  });
});
