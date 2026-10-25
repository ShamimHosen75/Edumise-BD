import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

import { cachedPublicQuery, DETAIL_REVALIDATE, TAGS } from "./cache";
import type { SitemapEntry } from "./sitemap";

type Row = { updated_at: string | null };

/** Published public content for the sitemap. RLS hides drafts and scheduled items. */
export const getSitemapEntries = cachedPublicQuery<SitemapEntry[], []>(
  "sitemap",
  [
    TAGS.pages,
    TAGS.notices,
    TAGS.news,
    TAGS.events,
    TAGS.gallery,
    TAGS.downloads,
    TAGS.staff,
  ],
  async () => {
    const db = createPublicClient();
    const LIMIT = 5000;
    const [pages, notices, news, events, albums, downloads, staff] =
      await Promise.all([
        db
          .from("pages")
          .select("slug, updated_at")
          .eq("has_content", true)
          .limit(LIMIT),
        db
          .from("notices")
          .select("slug, updated_at")
          .eq("audience", "public")
          .limit(LIMIT),
        db.from("news").select("slug, updated_at").limit(LIMIT),
        db.from("events").select("slug, updated_at").limit(LIMIT),
        db.from("gallery_albums").select("slug, updated_at").limit(LIMIT),
        db.from("downloads").select("id, updated_at").limit(LIMIT),
        db.from("public_staff").select("id").limit(LIMIT),
      ]);
    const all = [pages, notices, news, events, albums, downloads, staff];
    const failed = all.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    const bySlug = (prefix: string, rows: (Row & { slug: string })[] | null) =>
      (rows ?? []).map((r) => ({
        path: `${prefix}/${r.slug}`,
        lastModified: r.updated_at,
      }));
    return [
      ...bySlug("/p", pages.data),
      ...bySlug("/notices", notices.data),
      ...bySlug("/news", news.data),
      ...bySlug("/events", events.data),
      ...bySlug("/gallery", albums.data),
      ...(downloads.data ?? []).map((d) => ({
        path: `/downloads/${d.id}`,
        lastModified: d.updated_at,
      })),
      ...(staff.data ?? []).map((p) => ({ path: `/teachers/${p.id}` })),
    ];
  },
  [],
  DETAIL_REVALIDATE,
);
