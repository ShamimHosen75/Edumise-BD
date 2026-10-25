import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ShareButtons } from "@/components/site/content/share-buttons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { formatDate, pickLocalized } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { getNewsItem } from "@/lib/site/content-data";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; slug: string }> };

// Five minutes: an item scheduled for later appears soon after its time.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const item = await getNewsItem(slug);
  if (!item) return {};
  return detailMetadata({
    lang,
    path: `/news/${slug}`,
    title: pickLocalized(item, "title", lang),
    bodyHtml: pickLocalized(item, "body", lang),
    image: publicMediaUrl(item.cover_path),
    publishedTime: item.published_at,
  });
}

export default async function NewsItemPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const item = await getNewsItem(slug);
  if (!item) notFound();
  const dict = await getDictionary(lang);
  const labels = contentLabels(dict, lang);
  const title = pickLocalized(item, "title", lang);
  const cover = publicMediaUrl(item.cover_path);
  const html = sanitizeRichText(pickLocalized(item, "body", lang), {
    mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
      <Link
        href={`/${lang}/news`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span>{" "}
        {t(dict, "content.allItems", { section: dict.content.news })}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {item.published_at ? (
          <p className="text-muted-foreground text-sm">
            {t(dict, "content.publishedOn", {
              date: formatDate(item.published_at, lang),
            })}
          </p>
        ) : null}
      </header>
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={960}
          height={540}
          priority
          sizes="(min-width: 768px) 768px, 100vw"
          className="aspect-video w-full rounded-xl object-cover"
        />
      ) : null}
      {html ? (
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null}
      <ShareButtons title={title} labels={labels.share} />
    </article>
  );
}
