import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * D1 (Step 6.2): a switched-off login is also blocked in Supabase Auth, so it cannot get
 * a new token (or refresh an old one) and read data through the API. Call only after the
 * admin's role and target checks, and after `profiles.is_active` was changed.
 */
export async function setLoginBlocked(
  profileId: string,
  blocked: boolean,
): Promise<boolean> {
  const { error } = await createAdminClient().auth.admin.updateUserById(
    profileId,
    { ban_duration: blocked ? "876000h" : "none" },
  );
  return !error;
}
