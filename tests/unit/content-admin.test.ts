import { describe, expect, it } from "vitest";

import en from "@/dictionaries/en.json";
import { leafKeys } from "@/lib/content/admin-messages";
import { fitWithin, webpName } from "@/lib/content/image-size";
import {
  canPublish,
  contentStatus,
  isContentModule,
  MODULE_ROLES,
  publicPath,
} from "@/lib/content/modules";
import { toContentRow, toFormValues } from "@/lib/content/rows";
import { fileTooLarge, fileTypeLabel } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { buildSitemap } from "@/lib/site/sitemap";
import { CONTENT_SCHEMAS } from "@/lib/validation/content";

describe("content modules", () => {
  it("knows its modules", () => {
    expect(isContentModule("notices")).toBe(true);
    expect(isContentModule("pages")).toBe(false);
    expect(isContentModule("__proto__")).toBe(false);
  });
  it("lets teachers into notices only, and only admins publish", () => {
    expect(MODULE_ROLES.notices).toContain("teacher");
    for (const m of ["news", "events", "gallery", "downloads"] as const)
      expect(MODULE_ROLES[m]).not.toContain("teacher");
    expect(canPublish("admin")).toBe(true);
    expect(canPublish("super_admin")).toBe(true);
    expect(canPublish("teacher")).toBe(false);
    expect(canPublish(null)).toBe(false);
  });
  it("builds public addresses", () => {
    expect(publicPath("notices", { id: 3, slug: "exam" })).toBe(
      "/notices/exam",
    );
    expect(publicPath("downloads", { id: 7 })).toBe("/downloads/7");
  });
  it("tells drafts, scheduled and live items apart", () => {
    const now = new Date("2026-10-24T06:00:00Z");
    expect(contentStatus(false, null, now)).toBe("draft");
    expect(contentStatus(false, "2026-10-01T00:00:00Z", now)).toBe("draft");
    expect(contentStatus(true, "2026-10-25T00:00:00Z", now)).toBe("scheduled");
    expect(contentStatus(true, "2026-10-24T05:59:00Z", now)).toBe("published");
  });
});

describe("toContentRow", () => {
  const notice = CONTENT_SCHEMAS.notices.parse({
    slug: "exam-routine",
    title_en: "Exam routine",
    title_bn: "",
    body_en:
      '<p>Hi</p><script>alert(1)</script><img src="https://evil.test/x.png">',
    body_bn: "",
    category: "exam",
    audience: "public",
    target_class_id: null,
    is_pinned: false,
    is_published: true,
    published_at: "",
  });
  const opts = { canPublish: true, existingPublishedAt: null };

  it("sanitises the body", () => {
    const row = toContentRow("notices", notice, opts);
    expect(row.body_en).toBe("<p>Hi</p>");
  });
  it("publishes now when no date is given, and keeps the first publish date", () => {
    const row = toContentRow("notices", notice, opts);
    expect(row.is_published).toBe(true);
    expect(Date.parse(String(row.published_at))).toBeGreaterThan(
      Date.now() - 60_000,
    );
    const again = toContentRow("notices", notice, {
      ...opts,
      existingPublishedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(again.published_at).toBe("2026-01-01T00:00:00.000Z");
  });
  it("schedules with a chosen Bangladesh time", () => {
    const row = toContentRow(
      "notices",
      { ...notice, published_at: "2026-11-05T09:00" },
      opts,
    );
    expect(row.published_at).toBe("2026-11-05T03:00:00.000Z");
  });
  it("forces a draft for teachers, whatever the form says", () => {
    const row = toContentRow("notices", notice, {
      canPublish: false,
      existingPublishedAt: null,
    });
    expect(row.is_published).toBe(false);
    expect(row.published_at).toBeNull();
    const kept = toContentRow("notices", notice, {
      canPublish: false,
      existingPublishedAt: "2026-12-01T00:00:00.000Z",
    });
    expect(kept.published_at).toBe("2026-12-01T00:00:00.000Z");
  });
  it("converts event times and empty end, and album dates", () => {
    const event = CONTENT_SCHEMAS.events.parse({
      slug: "sports",
      title_en: "Sports",
      title_bn: "",
      body_en: "",
      body_bn: "",
      venue_en: "Field",
      venue_bn: "",
      starts_at: "2026-12-01T09:00",
      ends_at: "",
      album_id: null,
      is_published: false,
      published_at: "",
    });
    const row = toContentRow("events", event, opts);
    expect(row.starts_at).toBe("2026-12-01T03:00:00.000Z");
    expect(row.ends_at).toBeNull();
    const album = toContentRow(
      "gallery",
      CONTENT_SCHEMAS.gallery.parse({
        slug: "a",
        title_en: "A",
        title_bn: "",
        event_date: "",
        is_published: false,
        published_at: "",
      }),
      opts,
    );
    expect(album.event_date).toBeNull();
  });
});

describe("toFormValues", () => {
  it("gives empty, valid-looking defaults for a new item", () => {
    expect(toFormValues("downloads", null)).toEqual({
      title_en: "",
      title_bn: "",
      is_published: false,
      published_at: "",
      category: "general",
    });
  });
  it("shows stored times in Bangladesh time and round-trips through the schema", () => {
    const values = toFormValues("events", {
      slug: "x",
      title_en: "X",
      starts_at: "2026-12-01T03:00:00+00:00",
      ends_at: null,
      album_id: 4,
      is_published: true,
      published_at: "2026-10-01T00:00:00+00:00",
    });
    expect(values).toMatchObject({
      starts_at: "2026-12-01T09:00",
      ends_at: "",
      album_id: 4,
      published_at: "2026-10-01T06:00",
    });
    expect(CONTENT_SCHEMAS.events.safeParse(values).success).toBe(true);
  });
});

describe("files and images", () => {
  it("fits photos within 1600 px without enlarging", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 900, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 600)).toEqual({ width: 0, height: 0 });
  });
  it("names resized photos", () => {
    expect(webpName("IMG 0042.JPG")).toBe("img-0042.webp");
    expect(webpName("ছবি.png")).toBe("photo.webp");
  });
  it("labels file types and checks sizes", () => {
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(fileTypeLabel("image/jpeg")).toBe("JPG");
    expect(fileTypeLabel("text/html")).toBe("");
    expect(fileTypeLabel(null)).toBe("");
    const file = new File([new Uint8Array(10)], "a.pdf");
    expect(fileTooLarge(file, 5)).toBe(true);
    expect(fileTooLarge(file, 10)).toBe(false);
    expect(fileTooLarge(null, 10)).toBe(false);
    expect(fileTooLarge("text", 1)).toBe(false);
  });
});

describe("SEO helpers", () => {
  it("uses the configured site address, else localhost", () => {
    expect(getSiteUrl("https://school.edu.bd/")).toBe("https://school.edu.bd");
    expect(getSiteUrl("")).toBe("http://localhost:3000");
    expect(getSiteUrl("not a url")).toBe("http://localhost:3000");
  });
  it("lists every path in both languages with alternates", () => {
    const map = buildSitemap("https://s.bd", [
      { path: "/" },
      { path: "/news/a", lastModified: "2026-10-01T00:00:00Z" },
    ]);
    expect(map.map((e) => e.url)).toEqual([
      "https://s.bd/en",
      "https://s.bd/bn",
      "https://s.bd/en/news/a",
      "https://s.bd/bn/news/a",
    ]);
    expect(map[3]).toMatchObject({
      lastModified: "2026-10-01T00:00:00Z",
      alternates: { languages: { en: "https://s.bd/en/news/a" } },
    });
  });
  it("builds Open Graph tags for a detail page", () => {
    const meta = detailMetadata({
      lang: "bn",
      path: "/news/a",
      title: "শিরোনাম",
      bodyHtml: "<p>Some <b>text</b></p>",
      image: "/demo/a.jpg",
      publishedTime: "2026-10-01T00:00:00Z",
    });
    expect(meta.description).toBe("Some text");
    expect(meta.alternates?.canonical).toBe("/bn/news/a");
    expect(meta.openGraph).toMatchObject({
      title: "শিরোনাম",
      url: "/bn/news/a",
      locale: "bn_BD",
      type: "article",
      images: [{ url: "/demo/a.jpg" }],
    });
  });
});

describe("formatDateTime", () => {
  it("shows Bangladesh time on a 24-hour clock", () => {
    expect(formatDateTime("2026-10-24T09:30:00Z", "en")).toBe(
      "24 October 2026 at 15:30",
    );
    expect(formatDateTime("2026-10-24T09:30:00Z", "bn")).toContain("১৫:৩০");
  });
});

describe("leafKeys", () => {
  it("lists nested string keys", () => {
    const keys = leafKeys(en.contentAdmin, "contentAdmin");
    expect(keys).toContain("contentAdmin.save");
    expect(keys).toContain("contentAdmin.fields.title");
    expect(keys).toContain("contentAdmin.audiences.class");
  });
});
