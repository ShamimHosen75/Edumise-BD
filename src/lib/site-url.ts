/**
 * The public address of the site, used for sitemap, robots and Open Graph links.
 * Set NEXT_PUBLIC_SITE_URL in production; local runs fall back to localhost.
 */
export function getSiteUrl(
  configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const value = configured?.trim();
  if (value && /^https?:\/\/[^\s/]+/i.test(value))
    return value.replace(/\/+$/, "");
  return "http://localhost:3000";
}
