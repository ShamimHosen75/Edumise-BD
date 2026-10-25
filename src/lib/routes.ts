/**
 * Public pages that exist so far (paths without the /en or /bn prefix). Menu items,
 * buttons and quick links that point anywhere else are hidden until a later step adds
 * the page and its pattern here, so the site never shows a broken link.
 */
const AVAILABLE: readonly RegExp[] = [
  /^\/$/,
  /^\/login$/,
  /^\/forgot-password$/,
  /^\/p\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  // Step 2.3
  /^\/(notices|news|events|gallery|downloads)$/,
  /^\/(notices|news|events|gallery)\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/downloads\/[1-9][0-9]*$/,
  // Step 2.4
  /^\/(teachers|governing-body|ex-principals|contact)$/,
  /^\/teachers\/[1-9][0-9]*$/,
  // Step 3.3
  /^\/admission\/(apply|status)$/,
  // Step 3.5
  /^\/(routine|exam-routine|calendar)$/,
];

export function isAvailableRoute(path: string): boolean {
  return AVAILABLE.some((pattern) => pattern.test(path));
}

/** True for absolute https links (shown as-is, opened in a new tab). */
export function isExternal(url: string): boolean {
  return /^https:\/\//.test(url);
}

/** Internal paths get the language prefix: ("/p/library", "bn") -> "/bn/p/library". */
export function localizeHref(url: string, lang: string): string {
  if (isExternal(url)) return url;
  return url === "/" ? `/${lang}` : `/${lang}${url}`;
}

/** A link is shown if it is external (https) or an internal page that exists. */
export function isShowableLink(url: string | null | undefined): url is string {
  return !!url && (isExternal(url) || isAvailableRoute(url));
}
