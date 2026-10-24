import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type Limit = { max: number; windowSeconds: number };

/** Records a hit and returns true when the key is now over its limit. */
export async function hitRateLimit(
  key: string,
  limit: Limit,
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return data === true;
}

/** True when the key has already used its limit (does not record a hit). */
export async function isRateLimited(
  key: string,
  limit: Limit,
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("is_rate_limited", {
    p_key: key,
    p_max: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return data === true;
}
