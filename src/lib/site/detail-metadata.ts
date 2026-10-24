import type { Metadata } from "next";

import type { Locale } from "@/i18n/config";
import { excerpt } from "@/lib/content/excerpt";

/** Title, description, language alternates and Open Graph tags for a detail page. */
export function detailMetadata({
  lang,
  path,
  title,
  bodyHtml = "",
  image,
  publishedTime,
}: {
  lang: Locale;
  /** Path without the language, e.g. "/news/science-fair". */
  path: string;
  title: string;
  bodyHtml?: string;
  image?: string | null;
  publishedTime?: string | null;
}): Metadata {
  const description = excerpt(bodyHtml) || undefined;
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}${path}`,
      languages: { en: `/en${path}`, bn: `/bn${path}` },
    },
    openGraph: {
      title,
      description,
      url: `/${lang}${path}`,
      type: publishedTime ? "article" : "website",
      locale: lang === "bn" ? "bn_BD" : "en_GB",
      publishedTime: publishedTime ?? undefined,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}
