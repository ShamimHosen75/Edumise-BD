import { z } from "zod";

// Error messages are dictionary keys (errors.*), translated in the UI.

const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const digits = (pattern: RegExp, message: string) =>
  z.union([z.literal(""), z.string().regex(pattern, message)]);
const httpsUrl = z
  .url({ protocol: /^https$/, error: "errors.httpsUrl" })
  .max(500, "errors.tooLong");
const optionalUrl = z.union([z.literal(""), httpsUrl]);

/** Only Google Maps embed links may be shown in the contact page iframe. */
const mapEmbedUrl = z.union([
  z.literal(""),
  httpsUrl.refine((v) => {
    const u = new URL(v);
    return (
      u.hostname === "www.google.com" && u.pathname.startsWith("/maps/embed")
    );
  }, "errors.mapEmbed"),
]);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "errors.color");

const currentYear = new Date().getFullYear();

// An empty form field means "not set".
const establishedYear = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce
    .number({ error: "errors.year" })
    .int("errors.year")
    .min(1800, "errors.year")
    .max(currentYear, "errors.year")
    .nullable(),
);

export const schoolSettingsSchema = z.object({
  name_en: text(150).min(1, "errors.required"),
  name_bn: text(150),
  short_name: text(20),
  address_en: text(300),
  address_bn: text(300),
  phone: digits(/^\+?[0-9][0-9 -]{5,18}$/, "errors.phone"),
  email: z.union([
    z.literal(""),
    z.email("errors.email").max(200, "errors.tooLong"),
  ]),
  website_url: optionalUrl,
  facebook_url: optionalUrl,
  youtube_url: optionalUrl,
  map_embed_url: mapEmbedUrl,
  office_hours_en: text(200),
  office_hours_bn: text(200),
  primary_color: color,
  secondary_color: color,
  eiin: digits(/^[0-9]{6}$/, "errors.eiin"),
  institution_code: digits(/^[0-9]{1,10}$/, "errors.digits"),
  center_code: digits(/^[0-9]{1,10}$/, "errors.digits"),
  established_year: establishedYear,
  head_name_en: text(150),
  head_name_bn: text(150),
  head_message_en: text(5000),
  head_message_bn: text(5000),
});

export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
export type SchoolSettingsField = keyof SchoolSettingsInput;

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const logoFileSchema = z
  .instanceof(File)
  .refine((f) => f.size > 0 && f.size <= LOGO_MAX_BYTES, "errors.logoSize")
  .refine(
    (f) => (LOGO_TYPES as readonly string[]).includes(f.type),
    "errors.logoType",
  );
