import { describe, expect, it } from "vitest";

import { excerpt } from "@/lib/content/excerpt";
import { lastPage } from "@/lib/content/pagination";
import { deletablePaths } from "@/lib/files";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { pageSeo } from "@/lib/site/seo";
import { assertId, assertOptionalId } from "@/lib/validation/ids";

describe("deletablePaths (files a stored path may delete)", () => {
  it("keeps our uploads in the expected folders only", () => {
    expect(
      deletablePaths(
        [
          "notices/u1/a.pdf",
          "settings/logo.png",
          "demo/gallery-1.jpg",
          "notices/../settings/logo.png",
          "/notices/u1/a.pdf",
          null,
          42,
        ],
        ["notices/"],
      ),
    ).toEqual(["notices/u1/a.pdf"]);
  });
  it("accepts any of several folders", () => {
    expect(
      deletablePaths(
        ["pages/3/c.png", "attachments/3/a.pdf"],
        ["pages/3/", "attachments/3/"],
      ),
    ).toHaveLength(2);
    expect(deletablePaths(["pages/30/c.png"], ["pages/3/"])).toEqual([]);
  });
});

describe("assertId", () => {
  it("accepts positive whole numbers", () => {
    expect(assertId(7)).toBe(7);
    expect(assertOptionalId(null)).toBeNull();
  });
  it.each([0, -1, 1.5, "1", "../x", Number.NaN, undefined, 2 ** 60])(
    "rejects %s",
    (value) => {
      expect(() => assertId(value)).toThrow("Invalid id");
    },
  );
});

describe("excerpt", () => {
  it("shows characters, not HTML entities", () => {
    expect(excerpt("<p>Pass marks &lt; 33 &amp; &gt; 0</p>")).toBe(
      "Pass marks < 33 & > 0",
    );
    expect(excerpt('<p>Tom\'s "note"</p>')).toBe(`Tom's "note"`);
  });
  it("does not decode twice", () => {
    expect(excerpt("<p>&amp;lt;b&amp;gt;</p>")).toBe("&lt;b&gt;");
  });
  it("cuts long text at a word", () => {
    expect(excerpt(`<p>${"word ".repeat(50)}</p>`, 20)).toBe(
      "word word word word…",
    );
  });
});

describe("pageSeo", () => {
  const page = {
    title_en: "History",
    title_bn: "আমাদের ইতিহাস",
    body_en: "<p>Founded in 1975.</p>",
    body_bn: "<p>১৯৭৫ সালে প্রতিষ্ঠিত।</p>",
    seo_title_en: "Our History",
    seo_title_bn: "",
    seo_description_en: "School history",
    seo_description_bn: "",
  };
  it("prefers any Bangla text on Bangla pages", () => {
    expect(pageSeo(page, "bn")).toEqual({
      title: "আমাদের ইতিহাস",
      description: "১৯৭৫ সালে প্রতিষ্ঠিত।",
    });
  });
  it("falls back to English when there is no Bangla", () => {
    expect(pageSeo({ ...page, title_bn: "", body_bn: "" }, "bn")).toEqual({
      title: "Our History",
      description: "School history",
    });
    expect(pageSeo(page, "en").title).toBe("Our History");
  });
});

describe("pageAlternates", () => {
  it("links each page to the same page in the other language", () => {
    expect(pageAlternates("bn", "/notices")).toEqual({
      canonical: "/bn/notices",
      languages: { en: "/en/notices", bn: "/bn/notices" },
    });
    expect(pageAlternates("en", "/").canonical).toBe("/en");
  });
});

describe("lastPage", () => {
  it("is at least 1", () => {
    expect(lastPage(0)).toBe(1);
    expect(lastPage(10)).toBe(1);
    expect(lastPage(11)).toBe(2);
  });
});
