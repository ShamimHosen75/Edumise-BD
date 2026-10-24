import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

export type SessionClaims = { sub: string; app_role?: string | null } & Record<
  string,
  unknown
>;

/**
 * Refreshes the Supabase session cookie (if needed) and returns the verified JWT claims.
 * getClaims() checks the token signature locally, so no database query is made here.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const next = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();

  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = next();
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  return {
    response,
    claims: (data?.claims as SessionClaims | undefined) ?? null,
  };
}

/** A redirect that keeps any refreshed session cookies. */
export function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
