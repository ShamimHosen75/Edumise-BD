import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { DownloadMeta } from "@/components/site/content/download-meta";
import { FileAttachment } from "@/components/site/content/file-attachment";
import { ShareButtons } from "@/components/site/content/share-buttons";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { pickLocalized } from "@/lib/format";
import { getDownload } from "@/lib/site/content-data";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { publicDownloadUrl, publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; id: string }> };

export const revalidate = 3600;

const parseId = (raw: string) =>
  /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  const num = parseId(id);
  if (!isLocale(lang) || !num) return {};
  const item = await getDownload(num);
  if (!item) return {};
  return detailMetadata({
    lang,
    path: `/downloads/${num}`,
    title: pickLocalized(item, "title", lang),
    publishedTime: item.published_at,
  });
}

export default async function DownloadPage({ params }: Props) {
  const { lang, id } = await params;
  const num = parseId(id);
  if (!isLocale(lang) || !num) notFound();
  const item = await getDownload(num);
  if (!item) notFound();
  const dict = await getDictionary(lang);
  const labels = contentLabels(dict, lang);
  const title = pickLocalized(item, "title", lang);
  const view = publicMediaUrl(item.file_path);
  const file = publicDownloadUrl(item.file_path);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
      <Link
        href={`/${lang}/downloads`}
        className="text-primary text-sm hover:underline"
      >
        ← {t(dict, "content.allItems", { section: dict.content.downloads })}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <DownloadMeta item={item} lang={lang} dict={dict} />
      </header>
      {file ? (
        <a
          href={file}
          download
          className={buttonVariants({ className: "w-fit" })}
        >
          <Download aria-hidden="true" />
          {dict.content.download}
        </a>
      ) : null}
      {view ? (
        <FileAttachment
          url={view}
          isPdf={item.mime_type === "application/pdf"}
          title={title}
          labels={labels.attachment}
        />
      ) : null}
      <ShareButtons title={title} labels={labels.share} />
    </article>
  );
}
