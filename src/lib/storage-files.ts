import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deletablePaths } from "./files";

/** Deletes uploaded files under the given folders. Best effort: a failure leaves a file behind. */
export async function removeFiles(
  db: Pick<SupabaseClient, "storage">,
  paths: unknown[],
  prefixes: readonly string[],
) {
  const ours = deletablePaths(paths, prefixes);
  if (ours.length > 0) await db.storage.from("public-media").remove(ours);
}
