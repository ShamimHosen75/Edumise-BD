import type { Role } from "@/lib/auth/roles";

/** Content managed from the dashboard at /dashboard/<module>. */
export const CONTENT_MODULES = [
  "notices",
  "news",
  "events",
  "gallery",
  "downloads",
] as const;
export type ContentModule = (typeof CONTENT_MODULES)[number];

export const isContentModule = (value: string): value is ContentModule =>
  (CONTENT_MODULES as readonly string[]).includes(value);

export const MODULE_TABLE = {
  notices: "notices",
  news: "news",
  events: "events",
  gallery: "gallery_albums",
  downloads: "downloads",
} as const satisfies Record<ContentModule, string>;

const ADMINS: readonly Role[] = ["super_admin", "admin"];

/** Who may open each module. Teachers write notice drafts; admins do the rest. */
export const MODULE_ROLES: Record<ContentModule, readonly Role[]> = {
  notices: [...ADMINS, "teacher"],
  news: ADMINS,
  events: ADMINS,
  gallery: ADMINS,
  downloads: ADMINS,
};

export const canPublish = (role: Role | null | undefined): boolean =>
  role === "super_admin" || role === "admin";

/** The column that holds the module's file, and what may be uploaded there. */
export const MODULE_FILE = {
  notices: { column: "attachment_path", kind: "document" },
  news: { column: "cover_path", kind: "image" },
  events: { column: "cover_path", kind: "image" },
  gallery: { column: "cover_path", kind: "image" },
  downloads: { column: "file_path", kind: "document" },
} as const satisfies Record<
  ContentModule,
  { column: string; kind: "image" | "document" }
>;

/** Address of an item on the public site (without the language). */
export function publicPath(
  module: ContentModule,
  item: { id: number; slug?: string | null },
): string {
  return module === "downloads" || !item.slug
    ? `/${module}/${item.id}`
    : `/${module}/${item.slug}`;
}

export type ContentStatus = "draft" | "scheduled" | "published";

/** Draft, scheduled (published with a future date) or live. */
export function contentStatus(
  isPublished: boolean,
  publishedAt: string | null,
  now = new Date(),
): ContentStatus {
  if (!isPublished) return "draft";
  if (publishedAt && new Date(publishedAt).getTime() > now.getTime())
    return "scheduled";
  return "published";
}
