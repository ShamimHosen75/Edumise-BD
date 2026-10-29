import "server-only";

import type { ZodError } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Shared helpers for dashboard server actions (not a "use server" file, so none of
// these can be called from the browser).

export type FieldErrors = Record<string, TranslationKey>;
export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: TranslationKey; fieldErrors?: FieldErrors };

/** Checks the language and that the user is an admin; returns their Supabase client. */
export async function requireAdmin(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin"]);
  return createClient();
}

/** First message per field, from a Zod error whose messages are dictionary keys. */
export function zodFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues)
    fields[String(issue.path[0] ?? "form")] ??= issue.message as TranslationKey;
  return fields;
}

export function invalid(error: ZodError): ActionResult {
  return {
    ok: false,
    error: "contentAdmin.failed",
    fieldErrors: zodFieldErrors(error),
  };
}

/** A database error as a message people understand. */
export function dbError(
  error: { code?: string } | null,
  duplicateField?: string,
): ActionResult {
  if (error?.code === "23505")
    return {
      ok: false,
      error: "errors.duplicate",
      fieldErrors: duplicateField
        ? { [duplicateField]: "errors.duplicate" }
        : undefined,
    };
  if (error?.code === "23503") return { ok: false, error: "errors.inUse" };
  return { ok: false, error: "auth.unexpected" };
}

/** Checks the language and that the user may manage fees (office or accountant). */
export async function requireFeeStaff(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  const me = await requireRole(lang, ["super_admin", "admin", "accountant"]);
  return { me, db: await createClient() };
}
