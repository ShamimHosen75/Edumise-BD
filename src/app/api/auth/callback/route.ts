import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Password reset links land here: exchange the one-time code for a session, then go on.
const ALLOWED_NEXT = /^\/(en|bn)\/reset-password$/;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "";
  const lang = next.startsWith("/bn") ? "bn" : "en";
  const code = searchParams.get("code");

  if (code && ALLOWED_NEXT.test(next)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`/${lang}/login?error=link`, origin));
}
