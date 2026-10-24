import { describe, expect, it } from "vitest";

import { hasText, sanitizeRichText } from "@/lib/sanitize";
import { moveItem, nextSortOrder, type Sortable } from "@/lib/site/reorder";
import {
  menuItemColumns,
  menuItemSchema,
  pageSchema,
  slugify,
} from "@/lib/validation/page";

const MEDIA = "https://abc.supabase.co";
const clean = (html: string) => sanitizeRichText(html, { mediaBaseUrl: MEDIA });

describe("sanitizeRichText", () => {
  it("strips script tags and their content", () => {
    expect(clean("<p>Hi</p><script>alert(1)</script>")).toBe("<p>Hi</p>");
  });
  it("strips event handlers such as onerror and onclick", () => {
    const out = clean(
      `<p onclick="alert(1)">x</p><img src="${MEDIA}/storage/v1/object/public/public-media/a.png" onerror="alert(1)">`,
    );
    expect(out).not.toMatch(/onerror|onclick|alert/);
    expect(out).toContain("<img");
  });
  it("removes javascript:, data: and protocol-relative links", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<b>x</b>",
      "//evil.test/x",
    ]) {
      expect(clean(`<a href="${href}">x</a>`)).not.toMatch(
        /javascript|data:|evil/i,
      );
    }
  });
  it("removes iframes, styles, forms and unknown tags", () => {
    const out = clean(
      '<iframe src="https://evil.test"></iframe><style>body{}</style><form><input></form><p style="color:red">ok</p>',
    );
    expect(out).toBe("<p>ok</p>");
  });
  it("keeps formatting, lists, tables and safe links", () => {
    const html =
      '<h2>T</h2><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li>a</li></ul><table><tbody><tr><td>1</td></tr></tbody></table><a href="mailto:a@b.co">m</a><a href="/en/p/library">l</a>';
    expect(clean(html)).toBe(html);
  });
  it("opens external links in a new tab safely", () => {
    expect(clean('<a href="https://moedu.gov.bd/">x</a>')).toBe(
      '<a href="https://moedu.gov.bd/" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });
  it("keeps images from our storage and demo folder only", () => {
    expect(clean('<img src="https://tracker.test/pixel.gif">')).toBe("");
    expect(clean('<img src="/demo/slider-1.jpg" alt="x">')).toBe(
      '<img src="/demo/slider-1.jpg" alt="x" />',
    );
  });
  it("handles empty input", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });
  it("detects whether HTML has visible text", () => {
    expect(hasText("<p> </p><br>")).toBe(false);
    expect(hasText("<p>Hello</p>")).toBe(true);
  });
});

describe("slugify", () => {
  it("makes URL slugs from titles", () => {
    expect(slugify("Physics Lab 2")).toBe("physics-lab-2");
    expect(slugify("  Head teacher's message! ")).toBe(
      "head-teacher-s-message",
    );
    expect(slugify("Café")).toBe("cafe");
  });
  it("returns empty for Bangla-only titles (slug must then be typed)", () => {
    expect(slugify("গ্রন্থাগার")).toBe("");
  });
});

describe("pageSchema", () => {
  const valid = {
    slug: "library",
    title_en: "Library",
    title_bn: "",
    body_en: "<p>x</p>",
    body_bn: "",
    seo_title_en: "",
    seo_title_bn: "",
    seo_description_en: "",
    seo_description_bn: "",
    is_published: true,
  };
  it("accepts a valid page", () => {
    expect(pageSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    ["slug", "Library"],
    ["slug", "lib rary"],
    ["slug", "-lib"],
    ["slug", ""],
    ["title_en", ""],
    ["seo_description_en", "x".repeat(161)],
  ])("rejects %s = %j", (field, value) => {
    expect(pageSchema.safeParse({ ...valid, [field]: value }).success).toBe(
      false,
    );
  });
});

describe("menuItemSchema", () => {
  const base = {
    parent_id: 1,
    label_en: "Library",
    label_bn: "",
    link_type: "page" as const,
    page_id: 5,
    url: "",
    is_hidden: false,
  };
  it("accepts page and URL links", () => {
    expect(menuItemSchema.safeParse(base).success).toBe(true);
    expect(
      menuItemSchema.safeParse({
        ...base,
        link_type: "url",
        page_id: null,
        url: "/notices",
      }).success,
    ).toBe(true);
    expect(
      menuItemSchema.safeParse({
        ...base,
        link_type: "url",
        page_id: null,
        url: "https://moedu.gov.bd/",
      }).success,
    ).toBe(true);
  });
  it("rejects unsafe or missing links", () => {
    for (const url of ["javascript:alert(1)", "http://x.test", "notices", ""]) {
      expect(
        menuItemSchema.safeParse({ ...base, link_type: "url", url }).success,
      ).toBe(false);
    }
    expect(menuItemSchema.safeParse({ ...base, page_id: null }).success).toBe(
      false,
    );
  });
  it("lets only top-level menus be plain headings", () => {
    expect(
      menuItemSchema.safeParse({
        ...base,
        parent_id: null,
        link_type: "none",
        page_id: null,
      }).success,
    ).toBe(true);
    expect(
      menuItemSchema.safeParse({ ...base, link_type: "none", page_id: null })
        .success,
    ).toBe(false);
  });
  it("stores exactly one of page_id or url", () => {
    const v = menuItemSchema.parse({ ...base, url: "/ignored" });
    expect(menuItemColumns(v)).toMatchObject({ page_id: 5, url: null });
  });
});

describe("moveItem / nextSortOrder", () => {
  const items: Sortable[] = [
    { id: 1, parent_id: null, sort_order: 1 },
    { id: 2, parent_id: null, sort_order: 2 },
    { id: 3, parent_id: null, sort_order: 3 },
    { id: 10, parent_id: 1, sort_order: 5 },
    { id: 11, parent_id: 1, sort_order: 5 },
  ];
  it("swaps with the neighbour", () => {
    expect(moveItem(items, 2, "up")).toEqual([
      { id: 2, sort_order: 1 },
      { id: 1, sort_order: 2 },
    ]);
    expect(moveItem(items, 2, "down")).toEqual([
      { id: 3, sort_order: 2 },
      { id: 2, sort_order: 3 },
    ]);
  });
  it("does nothing at the ends or for unknown items", () => {
    expect(moveItem(items, 1, "up")).toEqual([]);
    expect(moveItem(items, 3, "down")).toEqual([]);
    expect(moveItem(items, 99, "up")).toEqual([]);
  });
  it("only moves among siblings and fixes ties", () => {
    expect(moveItem(items, 11, "up")).toEqual([
      { id: 11, sort_order: 1 },
      { id: 10, sort_order: 2 },
    ]);
  });
  it("places new items last", () => {
    expect(nextSortOrder(items, null)).toBe(4);
    expect(nextSortOrder(items, 1)).toBe(6);
    expect(nextSortOrder(items, 2)).toBe(1);
  });
});
