import { NextResponse, type NextRequest } from "next/server";

import { isLocale, type Locale } from "@/i18n/config";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/negotiate";
import { redirectWithCookies, updateSession } from "@/lib/supabase/middleware";

const AUTH_PAGES = ["login", "forgot-password"];
const SESSION_PAGES = [
  "dashboard",
  "change-password",
  "reset-password",
  ...AUTH_PAGES,
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, section] = pathname.split("/");

  if (!isLocale(first))
    return redirectToPreferredLocale(request, pathname, search);

  const headers = new Headers(request.headers);

  // Public pages skip the session check so they stay fast and cacheable.
  if (!section || !SESSION_PAGES.includes(section)) {
    return NextResponse.next({ request: { headers } });
  }

  const { response, claims } = await updateSession(request, headers);
  const lang: Locale = first;

  if (section === "dashboard" && !claims) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url, response);
  }
  // A logged-in user with a role does not need the login page. Without a role in the token,
  // or when the dashboard sent them here with an error, they stay (avoids redirect loops).
  if (
    AUTH_PAGES.includes(section) &&
    claims?.app_role &&
    !request.nextUrl.searchParams.has("error")
  ) {
    return redirectWithCookies(
      new URL(`/${lang}/dashboard`, request.url),
      response,
    );
  }
  return response;
}

function redirectToPreferredLocale(
  request: NextRequest,
  pathname: string,
  search: string,
) {
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
