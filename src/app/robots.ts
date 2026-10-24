import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The portal and sign-in pages are private or useless in search results.
      disallow: [
        "/api/",
        "/*/dashboard",
        "/*/login",
        "/*/forgot-password",
        "/*/reset-password",
        "/*/change-password",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
