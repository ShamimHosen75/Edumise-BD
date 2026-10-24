import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Anonymous client for public website data. It sends no cookies, so pages that use it
 * stay static and cacheable (ISR). RLS limits it to what any visitor may see.
 */
export function createPublicClient() {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Public URL of a file in the public-media bucket. */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Demo school photos ship with the app (public/demo); real uploads live in Storage.
  if (/^demo\/[a-z0-9-]+\.(jpg|png|webp)$/.test(path)) return `/${path}`;
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const safe = path.split("/").map(encodeURIComponent).join("/");
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${safe}`;
}
