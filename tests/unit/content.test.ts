import { describe, expect, it } from "vitest";

import {
  fromDhakaInput,
  isUpcoming,
  toDhakaInput,
} from "@/lib/content/datetime";
import {
  pageNumbers,
  pageRange,
  parsePage,
  totalPages,
} from "@/lib/content/pagination";
import { cleanSearch, shareLinks } from "@/lib/content/share";
import {
  eventSchema,
  noticeSchema,
  publishedAt,
} from "@/lib/validation/content";

describe("Bangladesh date-time helpers", () => {
  it("shows a stored time in Bangladesh time for the form", () => {
    expect(toDhakaInput("2026-11-05T03:00:00.000Z")).toBe("2026-11-05T09:00");
    expect(toDhakaInput("2026-12-31T20:30:00Z")).toBe("2027-01-01T02:30");
  });
  it("turns a typed Bangladesh time into UTC", () => {
    expect(fromDhakaInput("2026-11-05T09:00")).toBe("2026-11-05T03:00:00.000Z");
    expect(fromDhakaInput("2027-01-01T02:30")).toBe("2026-12-31T20:30:00.000Z");
  });
  it("round-trips", () => {
    expect(toDhakaInput(fromDhakaInput("2026-03-26T00:00"))).toBe(
      "2026-03-26T00:00",
    );
  });
  it("rejects bad input and impossible dates", () => {
    for (const bad of [
      "",
      "2026-11-05",
      "2026-02-31T10:00",
      "2026-11-05T25:00",
      "tomorrow",
      null,
      undefined,
    ]) {
      expect(fromDhakaInput(bad)).toBeNull();
    }
    expect(toDhakaInput("not a date")).toBe("");
    expect(toDhakaInput(null)).toBe("");
  });
  it("knows whether an event is still to come", () => {
    const now = new Date("2026-10-24T06:00:00Z");
    expect(isUpcoming("2026-11-05T03:00:00Z", null, now)).toBe(true);
    expect(
      isUpcoming("2026-03-26T03:00:00Z", "2026-03-26T06:00:00Z", now),
    ).toBe(false);
    // A running event (started, not ended) still counts as upcoming.
    expect(
      isUpcoming("2026-10-24T04:00:00Z", "2026-10-24T10:00:00Z", now),
    ).toBe(true);
  });
});

describe("pagination", () => {
  it("reads ?page safely", () => {
    expect(parsePage("3")).toBe(3);
    for (const bad of [undefined, "", "0", "-1", "2.5", "abc", "99999999"])
      expect(parsePage(bad)).toBe(1);
    expect(parsePage(["2", "5"])).toBe(2);
  });
  it("gives row ranges and page counts", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 9 });
    expect(pageRange(3, 12)).toEqual({ from: 24, to: 35 });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(10)).toBe(1);
    expect(totalPages(11)).toBe(2);
  });
  it("shows nearby pages with gaps", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 4, 5, 6, 7, 8, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 10, 11, 12]);
  });
});

describe("share links and search", () => {
  it("encodes the URL and title", () => {
    const links = shareLinks(
      "https://school.test/en/notices/a b",
      "Exam & results",
    );
    expect(links.facebook).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fschool.test%2Fen%2Fnotices%2Fa%20b",
    );
    expect(links.x).toContain("text=Exam%20%26%20results");
    expect(links.whatsapp).toContain(
      encodeURIComponent("Exam & results https://school.test/en/notices/a b"),
    );
  });
  it("cleans search text for database filters", () => {
    expect(cleanSearch("  exam,(routine)%_  ")).toBe("exam routine");
    expect(cleanSearch('a"b*c')).toBe("a b c");
    expect(cleanSearch(undefined)).toBe("");
    expect(cleanSearch("x".repeat(200))).toHaveLength(100);
  });
});

describe("content validation", () => {
  const notice = {
    slug: "exam-routine",
    title_en: "Exam routine",
    title_bn: "",
    body_en: "",
    body_bn: "",
    category: "exam" as const,
    audience: "public" as const,
    target_class_id: null,
    is_pinned: false,
    is_published: true,
    published_at: "",
  };
  it("accepts a valid notice", () => {
    expect(noticeSchema.safeParse(notice).success).toBe(true);
  });
  it("needs a class for a class notice, and drops it otherwise", () => {
    expect(
      noticeSchema.safeParse({ ...notice, audience: "class" }).success,
    ).toBe(false);
    expect(
      noticeSchema.safeParse({
        ...notice,
        audience: "class",
        target_class_id: 3,
      }).success,
    ).toBe(true);
    expect(
      noticeSchema.safeParse({ ...notice, audience: "class" }).success,
    ).toBe(false);
    // A class left over from an earlier choice is dropped for other audiences.
    expect(noticeSchema.parse({ ...notice, target_class_id: 3 })).toMatchObject(
      { target_class_id: null },
    );
  });
  it("rejects bad categories, slugs and dates", () => {
    expect(
      noticeSchema.safeParse({ ...notice, category: "sports" }).success,
    ).toBe(false);
    expect(
      noticeSchema.safeParse({ ...notice, slug: "Exam Routine" }).success,
    ).toBe(false);
    expect(
      noticeSchema.safeParse({ ...notice, published_at: "soon" }).success,
    ).toBe(false);
  });
  it("checks event times", () => {
    const event = {
      slug: "sports",
      title_en: "Sports",
      title_bn: "",
      body_en: "",
      body_bn: "",
      venue_en: "",
      venue_bn: "",
      starts_at: "2026-11-05T09:00",
      ends_at: "2026-11-05T16:00",
      album_id: null,
      is_published: true,
      published_at: "",
    };
    expect(eventSchema.safeParse(event).success).toBe(true);
    expect(
      eventSchema.safeParse({ ...event, ends_at: "2026-11-05T08:00" }).success,
    ).toBe(false);
    expect(eventSchema.safeParse({ ...event, starts_at: "" }).success).toBe(
      false,
    );
  });
  it("works out published_at", () => {
    expect(publishedAt(true, "2026-11-01T09:00", null)).toBe(
      "2026-11-01T03:00:00.000Z",
    );
    expect(publishedAt(true, "", "2026-01-01T00:00:00Z")).toBe(
      "2026-01-01T00:00:00Z",
    );
    expect(publishedAt(false, "", null)).toBeNull();
    expect(publishedAt(true, "", null)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("publishes now when the date of a scheduled item is cleared", () => {
    const now = new Date("2026-10-25T06:00:00Z");
    expect(publishedAt(true, "", "2026-12-01T00:00:00Z", now)).toBe(
      "2026-10-25T06:00:00.000Z",
    );
    // Unpublishing keeps the date, so it can be shown again later.
    expect(publishedAt(false, "", "2026-12-01T00:00:00Z", now)).toBe(
      "2026-12-01T00:00:00Z",
    );
  });
});
