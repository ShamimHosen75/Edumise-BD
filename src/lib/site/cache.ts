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
) {
  const cached = unstable_cache(query, [key], { tags, revalidate: 3600 });
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
