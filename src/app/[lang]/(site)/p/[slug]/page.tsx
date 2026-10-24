import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { formatDate, pickLocalized } from "@/lib/format";
import { toParagraphs } from "@/lib/site/text";
import { getPublishedPage } from "@/lib/site/data";

type Props = { params: Promise<{ lang: string; slug: string }> };

// Read-only page view. Step 2.2 adds rich text (sanitised HTML), cover image, attachments
// and the editor; until then the body is shown as plain text paragraphs.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const page = await getPublishedPage(slug);
  if (!page) return {};
  const title =
    pickLocalized(page, "seo_title", lang) ||
    pickLocalized(page, "title", lang);
  const description = pickLocalized(page, "seo_description", lang) || undefined;
  return { title, description };
}

export default async function CmsPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  const dict = await getDictionary(lang);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">
        {pickLocalized(page, "title", lang)}
      </h1>
      <p className="text-muted-foreground text-xs">
        {t(dict, "site.page.updated", {
          date: formatDate(page.updated_at, lang),
        })}
      </p>
      <div className="flex flex-col gap-4 leading-relaxed">
        {toParagraphs(pickLocalized(page, "body", lang)).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}
