import { toDhakaInput, fromDhakaInput } from "@/lib/content/datetime";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  publishedAt,
  type AlbumInput,
  type DownloadInput,
  type EventInput,
  type NewsInput,
  type NoticeInput,
} from "@/lib/validation/content";

import type { ContentModule } from "./modules";

export type ContentInput = {
  notices: NoticeInput;
  news: NewsInput;
  events: EventInput;
  gallery: AlbumInput;
  downloads: DownloadInput;
};

type Options = {
  /** Teachers may only save drafts. */
  canPublish: boolean;
  /** published_at already stored (kept when a published item is saved again). */
  existingPublishedAt: string | null;
  mediaBaseUrl?: string;
};

/** Validated form values -> database row: sanitised HTML, UTC times, publish rules. */
export function toContentRow<M extends ContentModule>(
  module: M,
  values: ContentInput[M],
  { canPublish, existingPublishedAt, mediaBaseUrl }: Options,
): Record<string, unknown> {
  const { published_at: localPublish, ...rest } = values;
  const isPublished = canPublish && values.is_published;
  const row: Record<string, unknown> = {
    ...rest,
    is_published: isPublished,
    published_at: canPublish
      ? publishedAt(isPublished, localPublish, existingPublishedAt)
      : null,
  };
  for (const field of ["body_en", "body_bn"] as const) {
    if (field in row)
      row[field] = sanitizeRichText(String(row[field]), { mediaBaseUrl });
  }
  if (module === "events") {
    const v = values as EventInput;
    row.starts_at = fromDhakaInput(v.starts_at);
    row.ends_at = v.ends_at ? fromDhakaInput(v.ends_at) : null;
  }
  if (module === "gallery")
    row.event_date = (values as AlbumInput).event_date || null;
  if (module === "notices" && (values as NoticeInput).audience !== "class")
    row.target_class_id = null;
  return row;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Database row (or nothing, for a new item) -> form values. */
export function toFormValues<M extends ContentModule>(
  module: M,
  row: Row | null,
): ContentInput[M] {
  const r = row ?? {};
  const common = {
    title_en: str(r.title_en),
    title_bn: str(r.title_bn),
    is_published: r.is_published === true,
    published_at: toDhakaInput(str(r.published_at) || null),
  };
  const slugged = { ...common, slug: str(r.slug) };
  const bodies = { body_en: str(r.body_en), body_bn: str(r.body_bn) };
  const id = (v: unknown) => (typeof v === "number" ? v : null);
  const values = {
    notices: {
      ...slugged,
      ...bodies,
      category: str(r.category) || "general",
      audience: str(r.audience) || "public",
      target_class_id: id(r.target_class_id),
      is_pinned: r.is_pinned === true,
    },
    news: { ...slugged, ...bodies },
    events: {
      ...slugged,
      ...bodies,
      venue_en: str(r.venue_en),
      venue_bn: str(r.venue_bn),
      starts_at: toDhakaInput(str(r.starts_at) || null),
      ends_at: toDhakaInput(str(r.ends_at) || null),
      album_id: id(r.album_id),
    },
    gallery: { ...slugged, event_date: str(r.event_date) },
    downloads: { ...common, category: str(r.category) || "general" },
  };
  return values[module] as ContentInput[M];
}
