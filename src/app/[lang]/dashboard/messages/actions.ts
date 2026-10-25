"use server";

import { z } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type InboxResult = { ok: true } | { ok: false; error: TranslationKey };

const id = z.number().int().positive();

async function admin(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin"]);
  return createClient();
}

export async function setMessageRead(
  lang: string,
  messageId: number,
  read: boolean,
): Promise<InboxResult> {
  const supabase = await admin(lang);
  if (!id.safeParse(messageId).success || typeof read !== "boolean")
    return { ok: false, error: "errors.notAllowed" };
  const { data, error } = await supabase
    .from("contact_messages")
    .update({ is_read: read, read_at: read ? new Date().toISOString() : null })
    .eq("id", messageId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "errors.notAllowed" };
  return { ok: true };
}

export async function deleteMessage(
  lang: string,
  messageId: number,
): Promise<InboxResult> {
  const supabase = await admin(lang);
  if (!id.safeParse(messageId).success)
    return { ok: false, error: "errors.notAllowed" };
  const { data, error } = await supabase
    .from("contact_messages")
    .delete()
    .eq("id", messageId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "errors.notAllowed" };
  return { ok: true };
}
