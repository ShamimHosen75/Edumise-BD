import type { MetadataRoute } from "next";

import { locales } from "@/i18n/config";

export type SitemapEntry = { path: string; lastModified?: string | null };

/** One sitemap URL per language for each path, each listing its other-language twin. */
export function buildSitemap(
  base: string,
  entries: SitemapEntry[],
): MetadataRoute.Sitemap {
  return entries.flatMap(({ path, lastModified }) => {
    const suffix = path === "/" ? "" : path;
    const languages = Object.fromEntries(
      locales.map((l) => [l, `${base}/${l}${suffix}`]),
    );
    return locales.map((lang) => ({
      url: `${base}/${lang}${suffix}`,
      lastModified: lastModified ?? undefined,
      alternates: { languages },
    }));
  });
}

/** Lists that always exist on the public site. */
export const STATIC_PATHS = [
  "/",
  "/notices",
  "/news",
  "/events",
  "/gallery",
  "/downloads",
  "/teachers",
  "/governing-body",
  "/ex-principals",
  "/contact",
  "/admission/apply",
  "/admission/status",
  "/routine",
  "/exam-routine",
  "/calendar",
];
