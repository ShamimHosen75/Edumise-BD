"use server";

import { headers } from "next/headers";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, rateKey } from "@/lib/rate-limit-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_LIMIT, contactSchema } from "@/lib/validation/people";

export type ContactResult =
  | { ok: true }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Record<string, TranslationKey>;
    };

/** Saves a contact form message. Visitors cannot write the table; this server does. */
export async function sendContactMessage(
  lang: string,
  input: unknown,
): Promise<ContactResult> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, TranslationKey> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] ??= issue.message as TranslationKey;
    return { ok: false, error: "contact.failed", fieldErrors };
  }
  const { website, ...message } = parsed.data;
  // Honeypot filled in: a bot. Answer as if it worked and store nothing.
  if (website) return { ok: true };

  const ip = clientIp(await headers());
  if (await hitRateLimit(rateKey("contact-ip", ip), CONTACT_LIMIT))
    return { ok: false, error: "contact.tooMany" };

  // Service role is used on the server only, after validation and the rate limit.
  const { error } = await createAdminClient()
    .from("contact_messages")
    .insert(message);
  if (error) return { ok: false, error: "auth.unexpected" };
  return { ok: true };
}
