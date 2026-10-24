import type { TranslationKey } from "@/i18n/t";
import { ROLE_HOME_SEGMENT, type Role } from "@/lib/auth/roles";

/** Icon names are mapped to lucide icons in the sidebar component. */
export type NavIcon = "home" | "settings" | "pages" | "menu";

export type NavItem = {
  key: string;
  /** Path under /[lang]/dashboard. "" means the role's own home page. */
  href: string;
  label: TranslationKey;
  icon: NavIcon;
  roles: readonly Role[];
};

const ALL_ROLES: readonly Role[] = [
  "super_admin",
  "admin",
  "teacher",
  "accountant",
  "student",
  "guardian",
];
const ADMINS: readonly Role[] = ["super_admin", "admin"];

/** Sidebar items. Later steps add their pages here. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "", label: "nav.home", icon: "home", roles: ALL_ROLES },
  {
    key: "pages",
    href: "/pages",
    label: "nav.pages",
    icon: "pages",
    roles: ADMINS,
  },
  {
    key: "menu",
    href: "/menu",
    label: "nav.menuBuilder",
    icon: "menu",
    roles: ADMINS,
  },
  {
    key: "settings",
    href: "/settings",
    label: "nav.settings",
    icon: "settings",
    roles: ADMINS,
  },
];

/**
 * Items a role may see, in config order, with "Home" pointing at that role's own page.
 * No role (or an unknown one) sees nothing.
 */
export function navForRole(
  role: Role | null | undefined,
  items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
  if (!role) return [];
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) =>
      item.href === ""
        ? { ...item, href: `/${ROLE_HOME_SEGMENT[role]}` }
        : item,
    );
}

/** True when the current path is this item or a page below it. */
export function isActive(
  item: Pick<NavItem, "href">,
  pathname: string,
  lang: string,
): boolean {
  const base = `/${lang}/dashboard${item.href}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
