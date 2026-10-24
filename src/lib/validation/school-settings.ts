import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/ }).max(500),
]);

/** Only Google Maps embed links may be shown in the contact page iframe. */
const mapEmbedUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/ }).refine((v) => {
    const u = new URL(v);
    return (
      u.hostname === "www.google.com" && u.pathname.startsWith("/maps/embed")
    );
  }, "Must be a Google Maps embed link"),
]);

const currentYear = new Date().getFullYear();

export const schoolSettingsSchema = z.object({
  name_en: text(150).min(1),
  name_bn: text(150),
  short_name: text(20),
  address_en: text(300),
  address_bn: text(300),
  phone: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9 -]{5,18}$/, "Invalid phone number"),
  ]),
  email: z.union([z.literal(""), z.email().max(200)]),
  website_url: optionalUrl,
  facebook_url: optionalUrl,
  youtube_url: optionalUrl,
  map_embed_url: mapEmbedUrl,
  office_hours_en: text(200),
  office_hours_bn: text(200),
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0f766e"),
  secondary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #f59e0b"),
  eiin: z.union([
    z.literal(""),
    z.string().regex(/^[0-9]{6}$/, "EIIN is 6 digits"),
  ]),
  institution_code: z.union([
    z.literal(""),
    z.string().regex(/^[0-9]{1,10}$/, "Digits only"),
  ]),
  center_code: z.union([
    z.literal(""),
    z.string().regex(/^[0-9]{1,10}$/, "Digits only"),
  ]),
  established_year: z.coerce
    .number()
    .int()
    .min(1800)
    .max(currentYear)
    .nullable(),
  head_name_en: text(150),
  head_name_bn: text(150),
  head_message_en: text(5000),
  head_message_bn: text(5000),
});

export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const logoFileSchema = z
  .instanceof(File)
  .refine(
    (f) => f.size > 0 && f.size <= LOGO_MAX_BYTES,
    "Logo must be at most 1 MB",
  )
  .refine(
    (f) => (LOGO_TYPES as readonly string[]).includes(f.type),
    "Logo must be PNG, JPG or WebP",
  );
