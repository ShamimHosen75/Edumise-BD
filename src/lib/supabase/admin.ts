import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

const serviceKeySchema = z
  .string()
  .min(1, "SUPABASE_SERVICE_ROLE_KEY is not set");

// Service-role client: bypasses RLS. Server-only; use only in trusted server code
// (e.g. admission submit, account creation) after checking the caller's role.
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const serviceKey = serviceKeySchema.parse(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
