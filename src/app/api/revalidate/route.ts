import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { TAGS } from "@/lib/site/cache";

/**
 * On-demand revalidation of the public site's cached content, for server-side callers
 * only (Supabase database webhooks, operations scripts, the test suite): data changed
 * outside the dashboard (a direct database change) is otherwise shown for up to an hour.
 *
 * POST { "tags": ["stats", "notices"] } with `Authorization: Bearer <REVALIDATE_SECRET>`.
 * Its own secret, not the service-role key: a webhook header is stored and logged where
 * a key that bypasses every access rule must never be (review S3).
 */
const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  const ok =
    secret.length >= 16 && timingSafeEqual(digest(given), digest(secret));
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
