import "server-only";

import { pageRange } from "@/lib/content/pagination";
import type { Tables } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

import { cachedDetailQuery, TAGS } from "./cache";

const db = () => createPublicClient();

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

type Notice = Tables<"notices">;
export type NoticeDetail = Pick<
  Notice,
  | "id"
  | "slug"
  | "title_en"
  | "title_bn"
  | "body_en"
  | "body_bn"
  | "category"
  | "attachment_path"
  | "published_at"
  | "updated_at"
>;
export type NewsDetail = Pick<
  Tables<"news">,
  | "id"
  | "slug"
  | "title_en"
  | "title_bn"
  | "body_en"
  | "body_bn"
  | "cover_path"
  | "published_at"
>;
export type AlbumImage = Pick<
  Tables<"gallery_images">,
  "id" | "image_path" | "caption_en" | "caption_bn" | "sort_order"
>;
type Album = Tables<"gallery_albums">;
export type EventDetail = Pick<
  Tables<"events">,
  | "id"
  | "slug"
  | "title_en"
  | "title_bn"
  | "body_en"
  | "body_bn"
  | "venue_en"
  | "venue_bn"
  | "starts_at"
  | "ends_at"
  | "cover_path"
> & {
  album:
    | (Pick<Album, "slug" | "title_en" | "title_bn"> & {
        gallery_images: AlbumImage[];
      })
    | null;
};
export type AlbumDetail = Pick<
  Album,
  "id" | "slug" | "title_en" | "title_bn" | "cover_path" | "event_date"
> & { gallery_images: AlbumImage[] };
export type DownloadDetail = Pick<
  Tables<"downloads">,
  | "id"
  | "title_en"
  | "title_bn"
  | "category"
  | "file_path"
  | "file_size"
  | "mime_type"
  | "published_at"
>;

/**
 * Throws on a failed list read and returns the total row count. A page past the end
 * (PostgREST PGRST103, "range not satisfiable") is not an error; PostgREST then sends no
 * count header, so the total is read from its message ("... there are only 14 rows").
 */
function listCount(
  count: number | null,
  error: { message: string; code?: string; details?: string } | null,
): number {
  if (!error) return count ?? 0;
  if (error.code !== "PGRST103") throw new Error(error.message);
  return Number(/only (\d+) rows?/.exec(error.details ?? "")?.[1] ?? 0);
}

type ListArgs = { q: string; page: number; category?: string };
type Listed<T> = { rows: T[]; count: number };

const like = (q: string, ...cols: string[]) =>
  cols.map((c) => `${c}.ilike.%${q}%`).join(",");

// Lists depend on the search and page, so they are read per request (no cache).

export async function listNotices({ q, page, category }: ListArgs) {
  const { from, to } = pageRange(page);
  let query = db()
    .from("notices")
    .select(
      "id, slug, title_en, title_bn, category, is_pinned, published_at, attachment_path",
      { count: "exact" },
    )
    .eq("audience", "public");
  if (category)
    query = query.eq("category", category as Tables<"notices">["category"]);
  if (q) query = query.or(like(q, "title_en", "title_bn"));
  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], count: listCount(count, error) };
}

export async function listNews({ q, page }: ListArgs) {
  const { from, to } = pageRange(page);
  let query = db()
    .from("news")
    .select(
      "id, slug, title_en, title_bn, body_en, body_bn, cover_path, published_at",
      {
        count: "exact",
      },
    );
  if (q) query = query.or(like(q, "title_en", "title_bn"));
  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .range(from, to);
  return { rows: data ?? [], count: listCount(count, error) };
}

export async function listEvents({
  page,
  when,
}: {
  page: number;
  when: "upcoming" | "past";
}) {
  const { from, to } = pageRange(page);
  const now = new Date().toISOString();
  let query = db()
    .from("events")
    .select(
      "id, slug, title_en, title_bn, venue_en, venue_bn, starts_at, ends_at, cover_path",
      { count: "exact" },
    );
  query =
    when === "upcoming"
      ? query
          .or(`starts_at.gte.${now},ends_at.gte.${now}`)
          .order("starts_at", { ascending: true })
      : query
          .lt("starts_at", now)
          .or(`ends_at.is.null,ends_at.lt.${now}`)
          .order("starts_at", { ascending: false });
  const { data, count, error } = await query.range(from, to);
  return { rows: data ?? [], count: listCount(count, error) };
}

export async function listAlbums({ page }: { page: number }) {
  const { from, to } = pageRange(page);
  const { data, count, error } = await db()
    .from("gallery_albums")
    .select(
      "id, slug, title_en, title_bn, cover_path, event_date, gallery_images(count)",
      { count: "exact" },
    )
    .order("event_date", { ascending: false, nullsFirst: false })
    .range(from, to);
  return {
    rows: (data ?? []).map(({ gallery_images, ...a }) => ({
      ...a,
      photos: (gallery_images as unknown as { count: number }[])[0]?.count ?? 0,
    })),
    count: listCount(count, error),
  };
}

export async function listDownloads({ q, page, category }: ListArgs) {
  const { from, to } = pageRange(page);
  let query = db()
    .from("downloads")
    .select(
      "id, title_en, title_bn, category, file_path, file_size, mime_type, published_at",
      { count: "exact" },
    );
  if (category) query = query.eq("category", category);
  if (q) query = query.or(like(q, "title_en", "title_bn"));
  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .range(from, to);
  return {
    rows: data ?? [],
    count: listCount(count, error),
  } satisfies Listed<unknown>;
}

// Detail pages are cached and refreshed when the content changes (revalidateTag).

export const getNotice = cachedDetailQuery<NoticeDetail | null, [string]>(
  "notice",
  [TAGS.notices],
  async (slug: string) =>
    check(
      await db()
        .from("notices")
        .select(
          "id, slug, title_en, title_bn, body_en, body_bn, category, attachment_path, published_at, updated_at",
        )
        .eq("slug", slug)
        .eq("audience", "public")
        .maybeSingle(),
    ),
);

export const getNewsItem = cachedDetailQuery<NewsDetail | null, [string]>(
  "news-item",
  [TAGS.news],
  async (slug: string) =>
    check(
      await db()
        .from("news")
        .select(
          "id, slug, title_en, title_bn, body_en, body_bn, cover_path, published_at",
        )
        .eq("slug", slug)
        .maybeSingle(),
    ),
);

export const getEvent = cachedDetailQuery<EventDetail | null, [string]>(
  "event",
  [TAGS.events, TAGS.gallery],
  async (slug: string) =>
    check(
      await db()
        .from("events")
        .select(
          "id, slug, title_en, title_bn, body_en, body_bn, venue_en, venue_bn, starts_at, ends_at, cover_path, album:gallery_albums(slug, title_en, title_bn, gallery_images(id, image_path, caption_en, caption_bn, sort_order))",
        )
        .eq("slug", slug)
        .maybeSingle(),
    ),
);

export const getAlbum = cachedDetailQuery<AlbumDetail | null, [string]>(
  "album",
  [TAGS.gallery],
  async (slug: string) =>
    check(
      await db()
        .from("gallery_albums")
        .select(
          "id, slug, title_en, title_bn, cover_path, event_date, gallery_images(id, image_path, caption_en, caption_bn, sort_order)",
        )
        .eq("slug", slug)
        .maybeSingle(),
    ),
);

export const getDownload = cachedDetailQuery<DownloadDetail | null, [number]>(
  "download",
  [TAGS.downloads],
  async (id: number) =>
    check(
      await db()
        .from("downloads")
        .select(
          "id, title_en, title_bn, category, file_path, file_size, mime_type, published_at",
        )
        .eq("id", id)
        .maybeSingle(),
    ),
);
