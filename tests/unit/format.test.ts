import { describe, expect, it } from "vitest";

import {
  formatWeekdayTime,
  formatCurrency,
  formatDate,
  formatNumber,
  localizeDigits,
  pickLocalized,
  toBanglaDigits,
} from "@/lib/format";

describe("toBanglaDigits", () => {
  it("converts every digit", () => {
    expect(toBanglaDigits("0123456789")).toBe("০১২৩৪৫৬৭৮৯");
  });
  it("accepts numbers and keeps other characters", () => {
    expect(toBanglaDigits(2026)).toBe("২০২৬");
    expect(toBanglaDigits("Roll 12, GPA 4.50")).toBe("Roll ১২, GPA ৪.৫০");
  });
  it("leaves text without digits alone", () => {
    expect(toBanglaDigits("")).toBe("");
    expect(toBanglaDigits("বাংলা")).toBe("বাংলা");
  });
});

describe("localizeDigits", () => {
  it("uses Bangla digits only for bn", () => {
    expect(localizeDigits("999999", "bn")).toBe("৯৯৯৯৯৯");
    expect(localizeDigits("999999", "en")).toBe("999999");
  });
});

describe("formatNumber", () => {
  it("groups in lakh style", () => {
    expect(formatNumber(1234567, "en")).toBe("12,34,567");
    expect(formatNumber(1234567, "bn")).toBe("১২,৩৪,৫৬৭");
  });
  it("can turn grouping off for years", () => {
    expect(formatNumber(1975, "bn", { grouping: false })).toBe("১৯৭৫");
    expect(formatNumber(1975, "en", { grouping: false })).toBe("1975");
  });
  it("supports fixed decimals", () => {
    expect(formatNumber(4.5, "en", { decimals: 2 })).toBe("4.50");
    expect(formatNumber(4.5, "bn", { decimals: 2 })).toBe("৪.৫০");
  });
});

describe("formatDate", () => {
  // 05:00 UTC = 11:00 in Dhaka (UTC+6).
  const date = "2026-10-24T05:00:00Z";
  it("formats in English and Bangla", () => {
    expect(formatDate(date, "en")).toBe("24 October 2026");
    expect(formatDate(date, "bn")).toBe("২৪ অক্টোবর, ২০২৬");
  });
  it("uses Bangladesh time, not UTC", () => {
    // 20:00 UTC on the 23rd is already the 24th in Dhaka.
    expect(formatDate("2026-10-23T20:00:00Z", "en")).toBe("24 October 2026");
  });
  it("supports short style", () => {
    expect(formatDate(new Date(date), "en", "short")).toBe("24/10/2026");
    expect(formatDate(new Date(date), "bn", "short")).toMatch(/^[০-৯/]+$/);
  });
  it("rejects invalid dates", () => {
    expect(() => formatDate("not a date", "en")).toThrow(RangeError);
  });
});

describe("formatCurrency", () => {
  it("formats poisha as taka with two decimals", () => {
    expect(formatCurrency(12345650, "en")).toBe("৳1,23,456.50");
    expect(formatCurrency(12345650, "bn")).toBe("১,২৩,৪৫৬.৫০৳");
  });
  it("handles zero, small and negative amounts", () => {
    expect(formatCurrency(0, "en")).toBe("৳0.00");
    expect(formatCurrency(5, "en")).toBe("৳0.05");
    expect(formatCurrency(-60000, "en")).toBe("-৳600.00");
  });
  it("rejects fractional poisha", () => {
    expect(() => formatCurrency(10.5, "en")).toThrow(RangeError);
  });
});

describe("pickLocalized", () => {
  const row = { title_en: "Holiday", title_bn: "ছুটি" };
  it("uses Bangla for bn", () => {
    expect(pickLocalized(row, "title", "bn")).toBe("ছুটি");
  });
  it("uses English for en", () => {
    expect(pickLocalized(row, "title", "en")).toBe("Holiday");
  });
  it("falls back to English when Bangla is empty, blank or missing", () => {
    expect(
      pickLocalized({ title_en: "Holiday", title_bn: "" }, "title", "bn"),
    ).toBe("Holiday");
    expect(
      pickLocalized({ title_en: "Holiday", title_bn: "   " }, "title", "bn"),
    ).toBe("Holiday");
    expect(
      pickLocalized({ title_en: "Holiday", title_bn: null }, "title", "bn"),
    ).toBe("Holiday");
    expect(pickLocalized({ title_en: "Holiday" }, "title", "bn")).toBe(
      "Holiday",
    );
  });
  it("returns an empty string when both are empty", () => {
    expect(
      pickLocalized({ title_en: null, title_bn: null }, "title", "bn"),
    ).toBe("");
  });
});

describe("formatWeekdayTime", () => {
  // 03:00 UTC = 09:00 Thursday in Dhaka.
  it("uses a 24-hour clock with no English AM/PM in Bangla", () => {
    expect(formatWeekdayTime("2026-11-05T03:00:00Z", "en")).toBe(
      "Thursday 09:00",
    );
    const bn = formatWeekdayTime("2026-11-05T03:00:00Z", "bn");
    expect(bn).toBe("বৃহস্পতিবার ০৯:০০");
    expect(bn).not.toMatch(/AM|PM|[0-9]/);
  });
  it("shows afternoon times in 24 hours", () => {
    expect(formatWeekdayTime("2026-11-05T09:30:00Z", "en")).toBe(
      "Thursday 15:30",
    );
  });
  it("rejects invalid dates", () => {
    expect(() => formatWeekdayTime("nope", "en")).toThrow(RangeError);
  });
});
