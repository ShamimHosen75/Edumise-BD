import { afterEach, describe, expect, it } from "vitest";

import en from "@/dictionaries/en.json";
import bn from "@/dictionaries/bn.json";
import type { Dictionary } from "@/i18n/get-dictionary";
import { inPlay } from "@/lib/collection";
import { sandboxProvider } from "@/lib/payments/sandbox";
import { pdfMoney, receiptQrPayload, receiverText } from "@/lib/receipt-text";
import { fineSettingsSchema } from "@/lib/validation/fees";

// Phase 5 code review regression tests (docs/code-review-phase-5.md).

afterEach(() => {
  delete process.env.PAYMENT_SANDBOX_SECRET;
  delete process.env.VERCEL_ENV;
});

describe("receipt text", () => {
  it("QR code shows the amount with two decimals", () => {
    expect(
      receiptQrPayload({
        receiptNo: "RCP-2026-000001",
        studentCode: "2026060001",
        amount: 120050,
        paidOn: "2026-10-10",
      }),
    ).toBe("RCP-2026-000001|2026060001|1200.50|2026-10-10");
  });
  it("an online payment is received by the gateway, named from the dictionary", () => {
    const online = { collectedBy: "", gateway: "sandbox" };
    expect(receiverText(online, en as Dictionary)).toBe(
      "Online payment (Sandbox (test only))",
    );
    expect(receiverText(online, bn as Dictionary)).toContain("অনলাইন");
    expect(
      receiverText(
        { collectedBy: "রফিক উদ্দিন", gateway: null },
        bn as Dictionary,
      ),
    ).toBe("রফিক উদ্দিন");
    expect(
      receiverText({ collectedBy: "", gateway: null }, en as Dictionary, "-"),
    ).toBe("-");
  });
  it("PDF money uses the dictionary's currency and lakh grouping", () => {
    expect(pdfMoney(12345650, "Tk")).toBe("Tk 1,23,456.50");
  });
});

describe("sandbox gateway", () => {
  it("is never available on the live site, even with its secret set", () => {
    process.env.PAYMENT_SANDBOX_SECRET = "a-long-enough-test-secret";
    expect(sandboxProvider.available()).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(sandboxProvider.available()).toBe(false);
  });
});

describe("collect screen", () => {
  it("a frozen fine left on its own can be paid by itself", () => {
    const items = [{ id: 5, invoiceId: 3, isFine: true }];
    expect(inPlay(items, new Set([5])).map((i) => i.id)).toEqual([5]);
  });
});

describe("late fine settings", () => {
  it("refuse more than the database allows, with a clear message", () => {
    const r = fineSettingsSchema.safeParse({
      late_fine_per_day: "2000000",
      late_fine_cap: "0",
      grace_days: "0",
      due_days: "15",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("errors.moneyTooLarge");
  });
});
