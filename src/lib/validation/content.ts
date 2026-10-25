import { z } from "zod";

import { fromDhakaInput } from "@/lib/content/datetime";

import { SLUG } from "./page";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const slug = z
  .string()
  .trim()
  .min(1, "errors.required")
  .max(80, "errors.tooLong")
  .regex(SLUG, "errors.slug");
const body = z.string().max(200_000, "errors.tooLong");
/** A datetime-local value in Bangladesh time. */
const localDateTime = z
  .string()
  .refine((v) => fromDhakaInput(v) !== null, "errors.dateTime");
const optionalLocalDateTime = z.union([z.literal(""), localDateTime]);

const publish = {
  is_published: z.boolean(),
  /** When it becomes visible; empty = now. A future time schedules it. */
  published_at: optionalLocalDateTime,
};

export const NOTICE_CATEGORIES = [
  "general",
  "exam",
  "result",
  "admission",
  "holiday",
] as const;
export const NOTICE_AUDIENCES = ["public", "staff", "class"] as const;
export const DOWNLOAD_CATEGORIES = [
  "general",
  "forms",
  "syllabus",
  "routine",
  "results",
  "calendar",
] as const;

export const noticeSchema = z
  .object({
    slug,
    title_en: text(200).min(1, "errors.required"),
    title_bn: text(200),
    body_en: body,
    body_bn: body,
    category: z.enum(NOTICE_CATEGORIES),
    audience: z.enum(NOTICE_AUDIENCES),
    target_class_id: z.number().int().positive().nullable(),
    is_pinned: z.boolean(),
    ...publish,
  })
  .refine((v) => v.audience !== "class" || v.target_class_id !== null, {
    message: "errors.classRequired",
    path: ["target_class_id"],
  })
  // A class picked before switching the audience away from "class" is dropped.
  .transform((v) =>
    v.audience === "class" ? v : { ...v, target_class_id: null },
  );

export const newsSchema = z.object({
  slug,
  title_en: text(200).min(1, "errors.required"),
  title_bn: text(200),
  body_en: body,
  body_bn: body,
  ...publish,
});

export const eventSchema = z
  .object({
    slug,
    title_en: text(200).min(1, "errors.required"),
    title_bn: text(200),
    body_en: body,
    body_bn: body,
    venue_en: text(200),
    venue_bn: text(200),
    starts_at: localDateTime,
    ends_at: optionalLocalDateTime,
    album_id: z.number().int().positive().nullable(),
    ...publish,
  })
  .refine((v) => !v.ends_at || v.ends_at >= v.starts_at, {
    message: "errors.endBeforeStart",
    path: ["ends_at"],
  });

export const albumSchema = z.object({
  slug,
  title_en: text(200).min(1, "errors.required"),
  title_bn: text(200),
  event_date: z.union([z.literal(""), z.iso.date("errors.date")]),
  ...publish,
});

export const downloadSchema = z.object({
  title_en: text(200).min(1, "errors.required"),
  title_bn: text(200),
  category: z.enum(DOWNLOAD_CATEGORIES),
  ...publish,
});

export type NoticeInput = z.infer<typeof noticeSchema>;
export type NewsInput = z.infer<typeof newsSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type AlbumInput = z.infer<typeof albumSchema>;
export type DownloadInput = z.infer<typeof downloadSchema>;

/**
 * published_at for the database: the chosen time, or "now" when publishing without one.
 * A past publish date is kept when an item is saved again; a future (scheduled) date is
 * replaced by now when the date is cleared, as the form's hint promises.
 */
export function publishedAt(
  isPublished: boolean,
  local: string,
  existing: string | null,
  now = new Date(),
): string | null {
  if (local) return fromDhakaInput(local);
  if (!isPublished) return existing;
  if (existing && new Date(existing).getTime() <= now.getTime())
    return existing;
  return now.toISOString();
}

/** The schema each dashboard module validates with (on the client and the server). */
export const CONTENT_SCHEMAS = {
  notices: noticeSchema,
  news: newsSchema,
  events: eventSchema,
  gallery: albumSchema,
  downloads: downloadSchema,
} as const;
