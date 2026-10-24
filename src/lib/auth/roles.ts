import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";

export const ROLES = [
  "super_admin",
  "admin",
  "teacher",
  "accountant",
  "student",
  "guardian",
] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/** URL segment of each role's home page under /[lang]/dashboard. */
export const ROLE_HOME_SEGMENT: Record<Role, string> = {
  super_admin: "super-admin",
  admin: "admin",
  teacher: "teacher",
  accountant: "accountant",
  student: "student",
  guardian: "guardian",
};

export function roleHomePath(lang: Locale, role: Role): string {
  return `/${lang}/dashboard/${ROLE_HOME_SEGMENT[role]}`;
}

/**
 * Where to go after login. Only paths inside our own dashboard are accepted, so a
 * crafted ?next= link cannot send users to another site.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  const match = /^\/([a-z]{2})\/dashboard(?:\/[A-Za-z0-9_-]+)*\/?$/.exec(next);
  if (!match || !isLocale(match[1])) return null;
  return next;
}
