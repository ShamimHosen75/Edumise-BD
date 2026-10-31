import { describe, expect, it } from "vitest";

import {
  amountFor,
  checkPayment,
  invoiceStatus,
  lateFine,
  monthKey,
  oneTimeKey,
  planInvoices,
  planSummary,
  toPoisha,
  toTakaText,
  totals,
  waiverAmount,
  type Structure,
  type Waiver,
} from "@/lib/fees";

describe("money in poisha", () => {
  it("reads taka as typed, Bangla digits included", () => {
    expect(toPoisha("600")).toBe(60000);
    expect(toPoisha("1,234.5")).toBe(123450);
    expect(toPoisha(" ৳ 1234.05 ")).toBe(123405);
    expect(toPoisha("১২০০.৫০")).toBe(120050);
    expect(toPoisha("0")).toBe(0);
  });
  it("refuses what is not a sum of money", () => {
    for (const bad of ["", "-5", "1.234", "abc", "12e3", "1.", "9999999999"])
      expect(toPoisha(bad), bad).toBeNull();
  });
  it("writes poisha back as taka for forms", () => {
    expect(toTakaText(60000)).toBe("600");
    expect(toTakaText(123405)).toBe("1234.05");
    expect(toTakaText(123450)).toBe("1234.50");
    expect(toTakaText(null)).toBe("");
  });
});

describe("waivers (Q37, Q38)", () => {
  const pct = (value: number): Waiver => ({ kind: "percent", value });
  const fixed = (value: number): Waiver => ({ kind: "fixed", value });
  it("no waiver", () => {
    expect(waiverAmount(60000, [])).toBe(0);
  });
  it("half free and full free (100%)", () => {
    expect(waiverAmount(60000, [pct(50)])).toBe(30000);
    expect(waiverAmount(60000, [pct(100)])).toBe(60000);
  });
  it("rounds a percent waiver down to the whole poisha", () => {
    // 33% of 1001 poisha = 330.33 -> 330
    expect(waiverAmount(1001, [pct(33)])).toBe(330);
    // 50% of 1 poisha = 0.5 -> 0
    expect(waiverAmount(1, [pct(50)])).toBe(0);
  });
  it("adds percents (at most 100%), then fixed; never more than the amount", () => {
    expect(waiverAmount(60000, [pct(50), pct(10)])).toBe(36000);
    expect(waiverAmount(60000, [pct(80), pct(40)])).toBe(60000);
    expect(waiverAmount(60000, [fixed(10000), pct(50)])).toBe(40000);
    expect(waiverAmount(60000, [pct(90), fixed(10000)])).toBe(60000);
    expect(waiverAmount(5000, [fixed(10000)])).toBe(5000);
  });
  it("refuses amounts that are not whole poisha", () => {
    expect(() => waiverAmount(10.5, [])).toThrow();
    expect(() => waiverAmount(-1, [])).toThrow();
  });
});

describe("fee structure", () => {
  const rows: Structure[] = [
    { classId: 9, groupId: null, feeHeadId: 1, amount: 80000 },
    { classId: 9, groupId: 2, feeHeadId: 1, amount: 90000 },
    { classId: 6, groupId: null, feeHeadId: 1, amount: 60000 },
  ];
  it("uses the group's amount, else the class amount", () => {
    expect(amountFor(rows, 9, 2, 1)).toBe(90000);
    expect(amountFor(rows, 9, 3, 1)).toBe(80000);
    expect(amountFor(rows, 9, null, 1)).toBe(80000);
    expect(amountFor(rows, 6, null, 1)).toBe(60000);
  });
  it("no row: nothing to bill", () => {
    expect(amountFor(rows, 7, null, 1)).toBeNull();
    expect(amountFor(rows, 9, null, 5)).toBeNull();
  });
});

describe("invoice totals, status and payments", () => {
  it("adds items", () => {
    expect(
      totals([
        { gross: 60000, waiver: 30000 },
        { gross: 50000, waiver: 0 },
      ]),
    ).toEqual({
      gross: 110000,
      waiver: 30000,
      net: 80000,
    });
    expect(totals([])).toEqual({ gross: 0, waiver: 0, net: 0 });
  });
  it("status from payments, partial included", () => {
    expect(invoiceStatus(60000, 0)).toBe("unpaid");
    expect(invoiceStatus(60000, 20000)).toBe("partial");
    expect(invoiceStatus(60000, 60000)).toBe("paid");
    expect(invoiceStatus(0, 0)).toBe("paid"); // fully waived
    expect(invoiceStatus(60000, 20000, true)).toBe("cancelled");
  });
  it("refuses overpayment", () => {
    expect(() => invoiceStatus(60000, 60001)).toThrow("Overpayment");
    expect(checkPayment(60001, 60000)).toBe("over");
    expect(checkPayment(0, 60000)).toBe("zero");
    expect(checkPayment(-5, 60000)).toBe("zero");
    expect(checkPayment(10.5, 60000)).toBe("zero");
    expect(checkPayment(60000, 60000)).toBe("ok");
    expect(checkPayment(1, 60000)).toBe("ok");
  });
});

describe("late fine (Q39)", () => {
  const rule = { perDay: 1000, cap: 10000, graceDays: 0 };
  it("nothing on or before the due date", () => {
    expect(lateFine(rule, "2026-10-15", "2026-10-15", 60000)).toBe(0);
    expect(lateFine(rule, "2026-10-15", "2026-10-01", 60000)).toBe(0);
  });
  it("per day after the due date, up to the cap", () => {
    expect(lateFine(rule, "2026-10-15", "2026-10-18", 60000)).toBe(3000);
    expect(lateFine(rule, "2026-10-15", "2026-12-31", 60000)).toBe(10000);
    expect(
      lateFine({ ...rule, cap: 0 }, "2026-10-15", "2026-12-14", 60000),
    ).toBe(60000);
  });
  it("grace days, paid invoices and no fine rule", () => {
    expect(
      lateFine({ ...rule, graceDays: 5 }, "2026-10-15", "2026-10-18", 60000),
    ).toBe(0);
    expect(
      lateFine({ ...rule, graceDays: 5 }, "2026-10-15", "2026-10-22", 60000),
    ).toBe(2000);
    expect(lateFine(rule, "2026-10-15", "2026-10-30", 0)).toBe(0);
    expect(
      lateFine({ ...rule, perDay: 0 }, "2026-10-15", "2026-10-30", 60000),
    ).toBe(0);
  });
  it("crosses months and years", () => {
    expect(lateFine({ ...rule, cap: 0 }, "2026-12-30", "2027-01-02", 1)).toBe(
      3000,
    );
  });
});

describe("period keys", () => {
  it("month or one-time", () => {
    expect(monthKey("2026-10")).toBe("2026-10");
    expect(() => monthKey("2026-13")).toThrow();
    expect(oneTimeKey(3, null)).toBe("session:3");
    expect(oneTimeKey(3, 12)).toBe("exam:12");
  });
});

describe("planning invoices", () => {
  const structures: Structure[] = [
    { classId: 6, groupId: null, feeHeadId: 1, amount: 60000 },
    { classId: 6, groupId: null, feeHeadId: 2, amount: 5000 },
    { classId: 9, groupId: null, feeHeadId: 1, amount: 80000 },
  ];
  const students = [
    { studentId: 1, classId: 6, groupId: null },
    { studentId: 2, classId: 6, groupId: null },
    { studentId: 3, classId: 9, groupId: 2 },
    { studentId: 4, classId: 7, groupId: null }, // no structure
  ];
  const waivers = new Map([
    [1, new Map([[1, [{ kind: "percent" as const, value: 50 }]]])],
  ]);

  it("bills each student every head their class has, after waivers", () => {
    const plan = planInvoices({
      students,
      feeHeadIds: [1, 2],
      structures,
      waivers,
      billed: new Set(),
    });
    expect(plan.invoices).toEqual([
      {
        studentId: 1,
        items: [
          { feeHeadId: 1, gross: 60000, waiver: 30000 },
          { feeHeadId: 2, gross: 5000, waiver: 0 },
        ],
        net: 35000,
      },
      {
        studentId: 2,
        items: [
          { feeHeadId: 1, gross: 60000, waiver: 0 },
          { feeHeadId: 2, gross: 5000, waiver: 0 },
        ],
        net: 65000,
      },
      {
        studentId: 3,
        items: [{ feeHeadId: 1, gross: 80000, waiver: 0 }],
        net: 80000,
      },
    ]);
    expect(planSummary(plan)).toEqual({
      invoices: 3,
      total: 180000,
      waived: 30000,
      skipped: 0,
    });
  });
  it("never bills the same student, head and period twice", () => {
    const billed = new Set(["1:1", "1:2", "2:1"]);
    const plan = planInvoices({
      students,
      feeHeadIds: [1, 2],
      structures,
      waivers,
      billed,
    });
    expect(
      plan.invoices.map((i) => [i.studentId, i.items.map((x) => x.feeHeadId)]),
    ).toEqual([
      [2, [2]],
      [3, [1]],
    ]);
    expect(plan.skipped).toBe(3);
  });
  it("a fully waived item still makes a (zero) invoice", () => {
    const full = new Map([
      [2, new Map([[1, [{ kind: "percent" as const, value: 100 }]]])],
    ]);
    const plan = planInvoices({
      students: [students[1]!],
      feeHeadIds: [1],
      structures,
      waivers: full,
      billed: new Set(),
    });
    expect(plan.invoices[0]).toMatchObject({
      net: 0,
      items: [{ gross: 60000, waiver: 60000 }],
    });
  });
});

describe("Phase 5 review", () => {
  it("an amount of 0 bills nothing (no empty paid invoice)", () => {
    const plan = planInvoices({
      students: [{ studentId: 9, classId: 1, groupId: null }],
      feeHeadIds: [7],
      structures: [{ classId: 1, groupId: null, feeHeadId: 7, amount: 0 }],
      waivers: new Map(),
      billed: new Set(),
    });
    expect(plan).toEqual({ invoices: [], skipped: 0 });
  });
});

describe("reading period keys", () => {
  it("month, session or exam", async () => {
    const { parsePeriod } = await import("@/lib/fees");
    expect(parsePeriod("2026-10")).toEqual({ kind: "month", month: "2026-10" });
    expect(parsePeriod("session:3")).toEqual({ kind: "session", id: 3 });
    expect(parsePeriod("exam:12")).toEqual({ kind: "exam", id: 12 });
    for (const bad of ["2026-13", "exam:0", "exam:x", "", "term:1"])
      expect(parsePeriod(bad), bad).toBeNull();
  });
});
