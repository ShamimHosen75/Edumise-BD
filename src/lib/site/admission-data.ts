import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

import { cachedPublicQuery, TAGS } from "./cache";

/** Classes and groups for the application form, and whether a session is open. */
export const getAdmissionOptions = cachedPublicQuery(
  "admission-options",
  [TAGS.stats],
  async () => {
    const db = createPublicClient();
    const [session, classes, groups] = await Promise.all([
      db
        .from("academic_sessions")
        .select("id")
        .eq("is_current", true)
        .maybeSingle(),
      db.from("classes").select("id, level, name_en, name_bn").order("level"),
      db.from("groups").select("id, name_en, name_bn").order("name_en"),
    ]);
    const failed = [session, classes, groups].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return {
      open: Boolean(session.data),
      classes: classes.data ?? [],
      groups: groups.data ?? [],
    };
  },
  { open: false, classes: [], groups: [] },
);
