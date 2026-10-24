import { defaultLocale, isLocale, type Locale } from "./config";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Parses an Accept-Language header into language codes, highest quality first. */
export function parseAcceptLanguage(
  header: string | null | undefined,
): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        lang: tag.trim().toLowerCase().split("-")[0] ?? "",
        quality,
        index,
      };
    })
    .filter(
      (x) =>
        x.lang && x.lang !== "*" && Number.isFinite(x.quality) && x.quality > 0,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((x) => x.lang);
}

/** Preferred language: saved cookie first, then the browser's Accept-Language, else English. */
export function pickLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  for (const lang of parseAcceptLanguage(acceptLanguage)) {
    if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}
