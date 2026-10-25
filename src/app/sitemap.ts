import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { buildSitemap, STATIC_PATHS } from "@/lib/site/sitemap";
import { getSitemapEntries } from "@/lib/site/sitemap-data";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  return buildSitemap(getSiteUrl(), [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...entries,
  ]);
}
