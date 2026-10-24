import "server-only";

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/public";

import type { Tables } from "./supabase/database.types";

export type SchoolSettings = Tables<"school_settings">;

/** Cache tag: call revalidateTag(SETTINGS_TAG) after settings change (Step 1.4 settings page). */
export const SETTINGS_TAG = "school-settings";

// Only successful reads are cached: an error is thrown out of the cached function, so a
// brief database outage is never remembered for the next hour.
const loadSettings = unstable_cache(
  async (): Promise<SchoolSettings | null> => {
    const { data, error } = await createPublicClient().from("school_settings").select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  ["school-settings"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

/**
 * School settings for branding, read through RLS as an anonymous visitor.
 * Returns null if the database is unreachable, so pages still render with defaults.
 */
export async function getSchoolSettings(): Promise<SchoolSettings | null> {
  try {
    return await loadSettings();
  } catch (error) {
    console.warn(
      `Could not load school settings; using defaults. (${error instanceof Error ? error.message : String(error)})`,
    );
    return null;
  }
}
