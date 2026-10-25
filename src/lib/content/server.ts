import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { TAGS } from "@/lib/site/cache";
import { createClient } from "@/lib/supabase/server";

import {
  isContentModule,
  MODULE_ROLES,
  MODULE_TABLE,
  type ContentModule,
} from "./modules";

// Helpers for the dashboard content actions. Kept out of the "use server" file so they
// are not callable from the browser.

type Ctx = {
  module: ContentModule;
  user: CurrentUser;
  /** Untyped client: the table name is chosen at run time. RLS still applies. */
  db: SupabaseClient;
  table: string;
};

/** Checks the language, the module and the user's role; RLS checks again in the database. */
export async function authorize(lang: string, module: string): Promise<Ctx> {
  if (!isLocale(lang) || !isContentModule(module))
    throw new Error("Invalid request");
  const user = await requireRole(lang, MODULE_ROLES[module]);
  const db = (await createClient()) as unknown as SupabaseClient;
  return { module, user, db, table: MODULE_TABLE[module] };
}

const MODULE_TAGS: Record<ContentModule, string[]> = {
  notices: [TAGS.notices],
  news: [TAGS.news],
  events: [TAGS.events],
  // Event pages show their album's photos.
  gallery: [TAGS.gallery, TAGS.events],
  downloads: [TAGS.downloads],
};

export function refreshModule(module: ContentModule) {
  for (const tag of MODULE_TAGS[module]) revalidateTag(tag);
}
