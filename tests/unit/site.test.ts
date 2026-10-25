import { describe, expect, it } from "vitest";

import {
  isAvailableRoute,
  isExternal,
  isShowableLink,
  localizeHref,
} from "@/lib/routes";
import { barPercent } from "@/lib/site/chart";
import { buildMenu, type MenuRow } from "@/lib/site/menu";

const row = (over: Partial<MenuRow> & { id: number }): MenuRow => ({
  parent_id: null,
  label_en: `Item ${over.id}`,
  label_bn: "",
  url: null,
  page_id: null,
  page: null,
  sort_order: over.id,
  ...over,
});

describe("route registry", () => {
  it("knows the pages that exist", () => {
    for (const p of [
      "/",
      "/login",
      "/forgot-password",
      "/p/about-us",
      "/p/ict-lab",
      "/notices",
      "/notices/exam-routine-2026",
      "/news",
      "/events/annual-sports-2026",
      "/gallery",
      "/gallery/annual-sports-2025",
      "/downloads",
      "/downloads/12",
      "/teachers",
      "/teachers/3",
      "/governing-body",
      "/ex-principals",
      "/contact",
      "/admission/apply",
      "/admission/status",
      "/routine",
      "/exam-routine",
      "/calendar",
    ])
      expect(isAvailableRoute(p)).toBe(true);
  });
  it("hides pages from later steps and odd paths", () => {
    for (const p of [
      "/routine/1",
      "/teachers/0",
      "/teachers/kamal",
      "/notices/Exam",
      "/downloads/0",
      "/downloads/abc",
      "/news/a/b",
      "/admission/other",
      "/result",
      "/p/",
      "/p/About",
      "/p/a/b",
      "/p/a--b",
      "//evil",
    ]) {
      expect(isAvailableRoute(p)).toBe(false);
    }
  });
  it("treats only https links as external", () => {
    expect(isExternal("https://moedu.gov.bd/")).toBe(true);
    expect(isExternal("http://moedu.gov.bd/")).toBe(false);
    expect(isExternal("javascript:alert(1)")).toBe(false);
  });
  it("shows external https links and internal pages that exist", () => {
    expect(isShowableLink("https://moedu.gov.bd/")).toBe(true);
    expect(isShowableLink("/login")).toBe(true);
    expect(isShowableLink("/result")).toBe(false);
    expect(isShowableLink(null)).toBe(false);
  });
  it("adds the language to internal links only", () => {
    expect(localizeHref("/", "bn")).toBe("/bn");
    expect(localizeHref("/p/library", "bn")).toBe("/bn/p/library");
    expect(localizeHref("https://moedu.gov.bd/", "bn")).toBe(
      "https://moedu.gov.bd/",
    );
  });
});

describe("buildMenu", () => {
  const rows: MenuRow[] = [
    row({ id: 1, label_en: "Home", label_bn: "হোম", url: "/" }),
    row({ id: 2, label_en: "About", label_bn: "সম্পর্কে" }),
    row({
      id: 3,
      parent_id: 2,
      label_en: "About us",
      page_id: 10,
      page: { slug: "about-us", is_published: true, has_content: true },
    }),
    row({
      id: 4,
      parent_id: 2,
      label_en: "History",
      page_id: 11,
      page: { slug: "history", is_published: false, has_content: true },
    }),
    row({
      id: 5,
      parent_id: 2,
      label_en: "Deleted page",
      page_id: 12,
      page: null,
    }),
    row({
      id: 10,
      parent_id: 2,
      label_en: "Empty page",
      page_id: 13,
      page: { slug: "donors", is_published: true, has_content: false },
    }),
    row({ id: 6, label_en: "Result" }),
    row({ id: 7, parent_id: 6, label_en: "Find a result", url: "/result" }),
    row({ id: 8, label_en: "Attendance", url: "/attendance" }),
    row({
      id: 9,
      label_en: "Board",
      url: "https://dhakaeducationboard.gov.bd/",
    }),
  ];

  it("keeps menus with something to open, in order", () => {
    expect(buildMenu(rows, "en").map((m) => m.label)).toEqual([
      "Home",
      "About",
      "Board",
    ]);
  });
  it("hides items whose page is unpublished, empty or deleted, and routes not built yet", () => {
    const about = buildMenu(rows, "en").find((m) => m.label === "About")!;
    expect(about.children.map((c) => c.label)).toEqual(["About us"]);
    expect(about.href).toBe("");
  });
  it("links pages and internal paths in the reader's language", () => {
    const bn = buildMenu(rows, "bn");
    expect(bn[0]).toMatchObject({ label: "হোম", href: "/bn", external: false });
    expect(bn[1]?.children[0]).toMatchObject({
      label: "About us",
      href: "/bn/p/about-us",
    });
  });
  it("marks external links", () => {
    expect(buildMenu(rows, "en").at(-1)).toMatchObject({
      href: "https://dhakaeducationboard.gov.bd/",
      external: true,
    });
  });
  it("sorts by sort_order, then id", () => {
    const shuffled = [
      row({ id: 2, url: "/", sort_order: 1 }),
      row({ id: 1, url: "/login", sort_order: 1 }),
      row({ id: 3, url: "/p/x", sort_order: 0 }),
    ];
    expect(buildMenu(shuffled, "en").map((m) => m.id)).toEqual([3, 1, 2]);
  });
  it("returns nothing for an empty menu", () => {
    expect(buildMenu([], "en")).toEqual([]);
  });
});

describe("barPercent", () => {
  it("scales to the largest value", () => {
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(1, 3)).toBe(33.3);
  });
  it("is 0 for empty, negative or broken input", () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(-1, 10)).toBe(0);
    expect(barPercent(Number.NaN, 10)).toBe(0);
  });
  it("never exceeds 100", () => {
    expect(barPercent(20, 10)).toBe(100);
  });
});
