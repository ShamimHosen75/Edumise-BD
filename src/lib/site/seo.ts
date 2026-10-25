import type { Locale } from "@/i18n/config";
import { excerpt } from "@/lib/content/excerpt";

type SeoRow = {
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  seo_title_en: string;
  seo_title_bn: string;
  seo_description_en: string;
  seo_description_bn: string;
};

const first = (...values: string[]) =>
  values.map((v) => v.trim()).find(Boolean) ?? "";

/**
 * Search title and description for a CMS page. In Bangla, any Bangla text wins over
 * English (an English SEO title must not hide a Bangla page title).
 */
export function pageSeo(row: SeoRow, lang: Locale) {
  const en = {
    title: first(row.seo_title_en, row.title_en),
    description: first(row.seo_description_en, excerpt(row.body_en)),
  };
  if (lang === "en") return en;
  return {
    title: first(row.seo_title_bn, row.title_bn, en.title),
    description: first(
      row.seo_description_bn,
      excerpt(row.body_bn),
      en.description,
    ),
  };
}
