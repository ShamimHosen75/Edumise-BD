import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { TAGS } from "@/lib/site/cache";

/**
 * On-demand revalidation of the public site's cached content, for server-side callers
 * only (Supabase database webhooks, operations scripts, the test suite): data changed
 * outside the dashboard (a direct database change) is otherwise shown for up to an hour.
 *
 * POST { "tags": ["stats", "notices"] } with `Authorization: Bearer <service-role key>`.
 */
export async function POST(request: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  const ok =
    secret.length >= 16 &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let tags: unknown;
  try {
    tags = (await request.json()).tags;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const known = new Set<string>(Object.values(TAGS));
  if (
    !Array.isArray(tags) ||
    !tags.every((t) => typeof t === "string" && known.has(t))
  )
    return NextResponse.json({ error: "unknown_tag" }, { status: 400 });
  for (const tag of tags as string[]) revalidateTag(tag);
  return NextResponse.json({ ok: true, revalidated: tags });
}
