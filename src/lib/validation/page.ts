import { z } from "zod";

// Error messages are dictionary keys (errors.*), translated in the UI.

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Turns a title into a URL slug: "Physics Lab 2" -> "physics-lab-2". Non-Latin titles give "". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const text = (max: number) => z.string().trim().max(max, "errors.tooLong");

export const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "errors.required")
    .max(80, "errors.tooLong")
    .regex(SLUG, "errors.slug"),
  title_en: text(200).min(1, "errors.required"),
  title_bn: text(200),
  body_en: z.string().max(200_000, "errors.tooLong"),
  body_bn: z.string().max(200_000, "errors.tooLong"),
  seo_title_en: text(70),
  seo_title_bn: text(70),
  seo_description_en: text(160),
  seo_description_bn: text(160),
  is_published: z.boolean(),
});
export type PageInput = z.infer<typeof pageSchema>;

const internalPath = /^\/[a-z0-9/_-]*$/;
const httpsUrl = /^https:\/\/[^\s<>"]+$/;

export const menuItemSchema = z
  .object({
    parent_id: z.number().int().positive().nullable(),
    label_en: text(80).min(1, "errors.required"),
    label_bn: text(80),
    link_type: z.enum(["none", "page", "url"]),
    page_id: z.number().int().positive().nullable(),
    url: z.string().trim().max(500, "errors.tooLong"),
    is_hidden: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.link_type === "page" && !v.page_id)
      ctx.addIssue({
        code: "custom",
        path: ["page_id"],
        message: "errors.required",
      });
    if (
      v.link_type === "url" &&
      !(internalPath.test(v.url) || httpsUrl.test(v.url))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "errors.menuUrl",
      });
    }
    if (v.link_type === "none" && v.parent_id !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["link_type"],
        message: "errors.menuChildLink",
      });
    }
  });
export type MenuItemInput = z.infer<typeof menuItemSchema>;

/** Database columns for a validated menu item (exactly one of page_id / url, or neither). */
export function menuItemColumns(v: MenuItemInput) {
  return {
    parent_id: v.parent_id,
    label_en: v.label_en,
    label_bn: v.label_bn,
    page_id: v.link_type === "page" ? v.page_id : null,
    url: v.link_type === "url" ? v.url : null,
    is_hidden: v.is_hidden,
  };
}
