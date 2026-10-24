import { isLocale, type Locale } from "./config";

/** Removes a leading /en or /bn from a pathname. Always returns a path starting with "/". */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts.splice(1, 1);
  const rest = parts.join("/");
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Same page in another language: /en/notices/5 -> /bn/notices/5. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const rest = stripLocale(pathname);
  return rest === "/" ? `/${locale}` : `/${locale}${rest}`;
}
