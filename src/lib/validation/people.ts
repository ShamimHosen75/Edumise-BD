import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

import { isBdPhone, normalizePhone } from "./auth";

// Error messages are dictionary keys (errors.*), translated in the UI.
const text = (max: number) => z.string().trim().max(max, "errors.tooLong");
const required = (max: number) => text(max).min(1, "errors.required");
const isoDate = z.iso.date("errors.date");
const year = z.coerce
  .number("errors.year")
  .int("errors.year")
  .min(1800, "errors.year")
  .max(new Date().getFullYear(), "errors.year");

export const governingSchema = z
  .object({
    full_name_en: required(100),
    full_name_bn: text(100),
    position_en: required(100),
    position_bn: text(100),
    term_start: isoDate,
    term_end: z.union([z.literal(""), isoDate]),
    sort_order: z.coerce
      .number("errors.digits")
      .int("errors.digits")
      .min(0, "errors.digits")
      .max(999, "errors.digits"),
  })
  .refine((v) => !v.term_end || v.term_end >= v.term_start, {
    message: "errors.endBeforeStart",
    path: ["term_end"],
  });

export const exPrincipalSchema = z
  .object({
    full_name_en: required(100),
    full_name_bn: text(100),
    from_year: year,
    to_year: year,
    note_en: text(300),
    note_bn: text(300),
  })
  .refine((v) => v.to_year >= v.from_year, {
    message: "errors.endBeforeStart",
    path: ["to_year"],
  });

export type GoverningInput = z.infer<typeof governingSchema>;
export type ExPrincipalInput = z.infer<typeof exPrincipalSchema>;

/** The public contact form. "website" is a honeypot: people never see or fill it. */
export const contactSchema = z.object({
  name: required(100),
  phone: z
    .string()
    .trim()
    .min(1, "errors.required")
    .transform((v) => normalizePhone(toAsciiDigits(v)))
    .refine(isBdPhone, "errors.mobile"),
  email: z.union([
    z.literal(""),
    z.email("errors.email").trim().max(200, "errors.tooLong"),
  ]),
  subject: required(150),
  message: z
    .string()
    .trim()
    .min(10, "errors.messageShort")
    .max(2000, "errors.tooLong"),
  website: z.string().max(200).optional(),
});
export type ContactInput = z.input<typeof contactSchema>;

/** Contact form limit: 5 messages an hour from one IP address. */
export const CONTACT_LIMIT = { max: 5, windowSeconds: 60 * 60 } as const;
