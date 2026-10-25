import type { TranslationKey } from "@/i18n/t";
import { ROLE_HOME_SEGMENT, type Role } from "@/lib/auth/roles";

/** Icon names are mapped to lucide icons in the sidebar component. */
export type NavIcon =
  | "academic"
  | "messages"
  | "governing"
  | "principals"
  | "home"
  | "settings"
  | "pages"
  | "menu"
  | "notices"
  | "news"
  | "events"
  | "gallery"
  | "downloads";

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
    key: "academic",
    href: "/academic",
    label: "nav.academic",
    icon: "academic",
    roles: ADMINS,
  },
  {
    key: "notices",
    href: "/notices",
    label: "nav.notices",
    icon: "notices",
    roles: [...ADMINS, "teacher"],
  },
  {
    key: "news",
    href: "/news",
    label: "nav.news",
    icon: "news",
    roles: ADMINS,
  },
  {
    key: "events",
    href: "/events",
    label: "nav.events",
    icon: "events",
    roles: ADMINS,
  },
  {
    key: "gallery",
    href: "/gallery",
    label: "nav.gallery",
    icon: "gallery",
    roles: ADMINS,
  },
  {
    key: "downloads",
    href: "/downloads",
    label: "nav.downloads",
    icon: "downloads",
    roles: ADMINS,
  },
  {
    key: "governing-body",
    href: "/governing-body",
    label: "nav.governingBody",
    icon: "governing",
    roles: ADMINS,
  },
  {
    key: "ex-principals",
    href: "/ex-principals",
    label: "nav.exPrincipals",
    icon: "principals",
    roles: ADMINS,
  },
  {
    key: "messages",
    href: "/messages",
    label: "nav.messages",
    icon: "messages",
    roles: ADMINS,
  },
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
