import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

import { cachedPublicQuery, TAGS } from "./cache";
import type { MenuRow } from "./menu";

const db = () => createPublicClient();
const nowIso = () => new Date().toISOString();

function check<T>({
  data,
  error,
}: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const getMenuRows = cachedPublicQuery(
  "menu",
  [TAGS.menu, TAGS.pages],
  async (): Promise<MenuRow[]> =>
    check(
      await db()
        .from("menu_items")
        .select(
          "id, parent_id, label_en, label_bn, url, page_id, sort_order, page:pages(slug, is_published, has_content)",
        )
        .order("sort_order"),
    ) as MenuRow[],
  [],
);

export const getSiteLinks = cachedPublicQuery(
  "site-links",
  [TAGS.links],
  async () =>
    check(
      await db()
        .from("site_links")
        .select("id, placement, label_en, label_bn, url, icon, sort_order")
        .eq("is_published", true)
        .order("sort_order"),
    ),
  [],
);

export const getLatestNotices = cachedPublicQuery(
  "latest-notices",
  [TAGS.notices],
  async (limit: number) =>
    check(
      await db()
        .from("notices")
        .select(
          "id, slug, title_en, title_bn, category, is_pinned, published_at",
        )
        .eq("audience", "public")
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(limit),
    ),
  [],
);

export const getUpcomingEvents = cachedPublicQuery(
  "upcoming-events",
  [TAGS.events],
  async (limit: number) =>
    check(
      await db()
        .from("events")
        .select("id, slug, title_en, title_bn, venue_en, venue_bn, starts_at")
        .gte("starts_at", nowIso())
        .order("starts_at")
        .limit(limit),
    ),
  [],
);

export const getSliders = cachedPublicQuery(
  "sliders",
  [TAGS.sliders],
  async () =>
    check(
      await db()
        .from("sliders")
        .select(
          "id, image_path, title_en, title_bn, subtitle_en, subtitle_bn, link_url",
        )
        .order("sort_order"),
    ),
  [],
);

export const getGalleryPreview = cachedPublicQuery(
  "gallery-preview",
  [TAGS.gallery],
  async (limit: number) =>
    check(
      await db()
        .from("gallery_images")
        .select(
          "id, image_path, caption_en, caption_bn, album:gallery_albums(title_en, title_bn, event_date)",
        )
        .order("created_at", { ascending: false })
        .order("sort_order")
        .limit(limit),
    ),
  [],
);

export const getStaffHighlights = cachedPublicQuery(
  "staff-highlights",
  [TAGS.staff],
  async (limit: number) =>
    check(
      await db()
        .from("public_staff")
        .select(
          "id, full_name_en, full_name_bn, photo_path, designation_en, designation_bn, subject_en, subject_bn",
        )
        .eq("is_current", true)
        .order("designation_rank")
        .order("sort_order")
        .limit(limit),
    ),
  [],
);

export type PublicStats = {
  classes: number;
  students: number;
  teachers: number;
  staff: number;
  by_class: {
    level: number;
    name_en: string;
    name_bn: string;
    students: number;
  }[];
};

export const getPublicStats = cachedPublicQuery(
  "public-stats",
  [TAGS.stats],
  async (): Promise<PublicStats | null> =>
    check(await db().rpc("public_stats")) as PublicStats | null,
  null,
);

export type PageRow = Pick<
  Tables<"pages">,
  | "id"
  | "slug"
  | "title_en"
  | "title_bn"
  | "body_en"
  | "body_bn"
  | "seo_title_en"
  | "seo_title_bn"
  | "seo_description_en"
  | "seo_description_bn"
  | "updated_at"
  | "cover_path"
  | "has_content"
>;

/** A published page (RLS hides drafts from visitors), or null. */
export const getPublishedPage = cachedPublicQuery<PageRow | null, [string]>(
  "page",
  [TAGS.pages],
  async (slug: string) =>
    check(
      await db()
        .from("pages")
        .select(
          "id, slug, title_en, title_bn, body_en, body_bn, seo_title_en, seo_title_bn, seo_description_en, seo_description_bn, updated_at, cover_path, has_content",
        )
        .eq("slug", slug)
        .maybeSingle(),
    ),
  null,
);

export const getPageAttachments = cachedPublicQuery(
  "page-attachments",
  [TAGS.pages],
  async (pageId: number) =>
    check(
      await db()
        .from("page_attachments")
        .select("id, label_en, label_bn, file_path, mime_type, file_size")
        .eq("page_id", pageId)
        .order("sort_order")
        .order("id"),
    ),
  [],
);
