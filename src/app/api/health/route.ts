import { NextResponse } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and the deployment (Step 6.4): is the app up, and can
 * it reach the database? Reads one public row as a visitor (RLS applies); never reveals
 * configuration or error details.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { error } = await createPublicClient()
      .from("school_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      { status: "ok", db: "ok", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
