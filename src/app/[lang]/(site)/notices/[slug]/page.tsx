import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FileAttachment } from "@/components/site/content/file-attachment";
import { ShareButtons } from "@/components/site/content/share-buttons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { formatDate, pickLocalized } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { getNotice } from "@/lib/site/content-data";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; slug: string }> };

// Five minutes: an item scheduled for later appears soon after its time.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const notice = await getNotice(slug);
  if (!notice) return {};
  const file = publicMediaUrl(notice.attachment_path);
  return detailMetadata({
    lang,
    path: `/notices/${slug}`,
    title: pickLocalized(notice, "title", lang),
    bodyHtml: pickLocalized(notice, "body", lang),
    image: file && !file.toLowerCase().endsWith(".pdf") ? file : null,
    publishedTime: notice.published_at,
  });
}

export default async function NoticePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const notice = await getNotice(slug);
  if (!notice) notFound();
  const dict = await getDictionary(lang);
  const labels = contentLabels(dict, lang);
  const title = pickLocalized(notice, "title", lang);
  const html = sanitizeRichText(pickLocalized(notice, "body", lang), {
    mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const file = publicMediaUrl(notice.attachment_path);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
      <Link
        href={`/${lang}/notices`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span>{" "}
        {t(dict, "content.allItems", { section: dict.content.notices })}
      </Link>
      <header className="flex flex-col gap-2">
        <span className="bg-muted w-fit rounded-full px-2 py-0.5 text-xs">
          {dict.content.categories[notice.category]}
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {notice.published_at ? (
          <p className="text-muted-foreground text-sm">
            {t(dict, "content.publishedOn", {
              date: formatDate(notice.published_at, lang),
            })}
          </p>
        ) : null}
      </header>
      {html ? (
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null}
      {file ? (
        <FileAttachment
          url={file}
          isPdf={file.toLowerCase().endsWith(".pdf")}
          title={title}
          labels={labels.attachment}
        />
      ) : null}
      <ShareButtons title={title} labels={labels.share} />
    </article>
  );
}
