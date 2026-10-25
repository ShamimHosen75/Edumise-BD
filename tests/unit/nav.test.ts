import { describe, expect, it } from "vitest";

import en from "@/dictionaries/en.json";
import { t } from "@/i18n/t";
import { ROLES, roleHomePath, safeNextPath, type Role } from "@/lib/auth/roles";
import { ROLE_WIDGETS } from "@/lib/dashboard-widgets";
import { isActive, NAV_ITEMS, navForRole, type NavItem } from "@/lib/nav";

const keys = (role: Role | null | undefined) =>
  navForRole(role).map((i) => i.key);

describe("navForRole", () => {
  const ADMIN_NAV = [
    "home",
    "academic",
    "notices",
    "news",
    "events",
    "gallery",
    "downloads",
    "governing-body",
    "ex-principals",
    "messages",
    "pages",
    "menu",
    "settings",
  ];
  it("admins see content, pages, menu and settings", () => {
    expect(keys("super_admin")).toEqual(ADMIN_NAV);
    expect(keys("admin")).toEqual(ADMIN_NAV);
  });
  it("teachers see only notices besides home", () => {
    expect(keys("teacher")).toEqual(["home", "notices"]);
  });
  it.each(["accountant", "student", "guardian"] as const)(
    "%s does not see content or settings",
    (role) => {
      expect(keys(role)).toEqual(["home"]);
    },
  );
  it("no role sees nothing", () => {
    expect(keys(null)).toEqual([]);
    expect(keys(undefined)).toEqual([]);
  });
  it("points Home at the role's own page", () => {
    expect(navForRole("teacher")[0]?.href).toBe("/teacher");
    expect(navForRole("super_admin")[0]?.href).toBe("/super-admin");
  });
  it("keeps config order and filters a custom list", () => {
    const items: NavItem[] = [
      {
        key: "a",
        href: "/a",
        label: "nav.home",
        icon: "home",
        roles: ["teacher"],
      },
      {
        key: "b",
        href: "/b",
        label: "nav.home",
        icon: "home",
        roles: ["admin", "teacher"],
      },
      {
        key: "c",
        href: "/c",
        label: "nav.home",
        icon: "home",
        roles: ["admin"],
      },
    ];
    expect(navForRole("teacher", items).map((i) => i.key)).toEqual(["a", "b"]);
    expect(navForRole("guardian", items)).toEqual([]);
  });
  it("every item has a real label and a unique key", () => {
    for (const item of NAV_ITEMS)
      expect(t(en, item.label)).not.toBe(item.label);
    expect(new Set(NAV_ITEMS.map((i) => i.key)).size).toBe(NAV_ITEMS.length);
  });
});

describe("isActive", () => {
  const settings = { href: "/settings" };
  it("matches the page and pages below it", () => {
    expect(isActive(settings, "/en/dashboard/settings", "en")).toBe(true);
    expect(isActive(settings, "/en/dashboard/settings/logo", "en")).toBe(true);
  });
  it("does not match look-alike paths or other languages", () => {
    expect(isActive(settings, "/en/dashboard/settings-old", "en")).toBe(false);
    expect(isActive(settings, "/bn/dashboard/settings", "en")).toBe(false);
  });
});

describe("role home pages", () => {
  it("every role has a home path and widgets", () => {
    for (const role of ROLES) {
      expect(roleHomePath("en", role)).toMatch(/^\/en\/dashboard\/[a-z-]+$/);
      expect(ROLE_WIDGETS[role].length).toBeGreaterThan(0);
      for (const key of ROLE_WIDGETS[role]) expect(t(en, key)).not.toBe(key);
    }
  });
  it("home paths are unique per role", () => {
    expect(new Set(ROLES.map((r) => roleHomePath("bn", r))).size).toBe(
      ROLES.length,
    );
  });
});

describe("safeNextPath", () => {
  it("accepts dashboard paths", () => {
    expect(safeNextPath("/en/dashboard")).toBe("/en/dashboard");
    expect(safeNextPath("/bn/dashboard/settings")).toBe(
      "/bn/dashboard/settings",
    );
  });
  it.each([
    "https://evil.test/en/dashboard",
    "//evil.test/en/dashboard",
    "/en/dashboard/../../evil",
    "/en/login",
    "/fr/dashboard",
    "/en/dashboard?x=1",
    "/en/dashboard\\evil",
    "",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
  it("rejects non-strings", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });
});
