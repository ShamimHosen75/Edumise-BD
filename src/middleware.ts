import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/negotiate";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (isLocale(first)) {
    // Pass the language on so the not-found page can translate itself.
    const headers = new Headers(request.headers);
    headers.set("x-locale", first);
    return NextResponse.next({ request: { headers } });
  }

  // No language in the URL: use the saved choice, then the browser's, then English.
  const locale = pickLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const response = NextResponse.redirect(url);
  response.headers.set("Vary", "Cookie, Accept-Language");
  return response;
}

export const config = {
  // Skip Next internals, API routes and files with an extension (favicon.ico, robots.txt...).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
