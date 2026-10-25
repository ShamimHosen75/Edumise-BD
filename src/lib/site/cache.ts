import "server-only";

import { unstable_cache } from "next/cache";

/** Cache tags for public content. Dashboard edits call revalidateTag(TAGS.x). */
export const TAGS = {
  settings: "school-settings",
  menu: "menu",
  links: "links",
  notices: "notices",
  events: "events",
  sliders: "sliders",
  gallery: "gallery",
  staff: "staff",
  stats: "stats",
  pages: "pages",
  news: "news",
  downloads: "downloads",
  governing: "governing-body",
  exPrincipals: "ex-principals",
} as const;

/**
 * A cached public query. Errors are thrown inside the cache (so they are never stored)
 * and turned into the fallback outside it, so one failing section cannot break the page.
 */
export function cachedPublicQuery<T, A extends unknown[]>(
  key: string,
  tags: string[],
  query: (...args: A) => Promise<T>,
  fallback: T,
  revalidate = 3600,
) {
  const cached = unstable_cache(query, [key], { tags, revalidate });
  return async (...args: A): Promise<T> => {
    try {
      return await cached(...args);
    } catch (error) {
      console.warn(
        `Could not load ${key}; showing it as empty. (${error instanceof Error ? error.message : String(error)})`,
      );
      return fallback;
    }
  };
}

/**
 * A cached query for detail pages. Errors are not swallowed: the page fails, so Next keeps
 * the last good copy instead of caching a "not found" for an item that exists.
 * Short lifetime (5 min) so scheduled items appear soon after their publish time.
 */
export function cachedDetailQuery<T, A extends unknown[]>(
  key: string,
  tags: string[],
  query: (...args: A) => Promise<T>,
) {
  return unstable_cache(query, [key], { tags, revalidate: DETAIL_REVALIDATE });
}

/** Seconds before content that may be scheduled is read again. */
export const DETAIL_REVALIDATE = 300;
