import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { pageSeo } from "@/lib/site/seo";
import { t } from "@/i18n/t";
import { fileTypeLabel } from "@/lib/files";
import { formatBytes, formatDate, pickLocalized } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { getPageAttachments, getPublishedPage } from "@/lib/site/data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; slug: string }> };

export const revalidate = 3600;

async function load(slug: string) {
  const page = await getPublishedPage(slug);
  // Unpublished pages never reach visitors (RLS); empty ones are treated as missing too.
  return page?.has_content ? page : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const page = await load(slug);
  if (!page) return {};
  const seo = pageSeo(page, lang);
  const title = seo.title;
  const description = seo.description || undefined;
  const cover = publicMediaUrl(page.cover_path);
  return {
    title,
    description,
    alternates: pageAlternates(lang, `/p/${slug}`),
    openGraph: {
      title,
      description,
      images: cover ? [cover] : undefined,
      type: "article",
    },
  };
}

export default async function CmsPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const page = await load(slug);
  if (!page) notFound();
  const [dict, attachments] = await Promise.all([
    getDictionary(lang),
    getPageAttachments(page.id),
  ]);
  const cover = publicMediaUrl(page.cover_path);
  // Sanitised again at render time: content written straight into the database is safe too.
  const html = sanitizeRichText(pickLocalized(page, "body", lang), {
    mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={1200}
          height={400}
          priority
          sizes="(min-width: 768px) 768px, 100vw"
          className="aspect-[3/1] w-full rounded-xl object-cover"
        />
      ) : null}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {pickLocalized(page, "title", lang)}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t(dict, "site.page.updated", {
            date: formatDate(page.updated_at, lang),
          })}
        </p>
      </header>
      {/* Safe: sanitised with an allow-list just above. */}
      <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
      {attachments.length > 0 ? (
        <section
          aria-labelledby="attachments-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <h2 id="attachments-title" className="font-semibold">
            {dict.site.page.attachments}
          </h2>
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={publicMediaUrl(a.file_path) ?? "#"}
                  download
                  className="text-primary flex items-center gap-2 text-sm hover:underline"
                >
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  <span>{pickLocalized(a, "label", lang)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(dict, "site.page.fileMeta", {
                      type:
                        fileTypeLabel(a.mime_type) || dict.site.page.download,
                      size: formatBytes(a.file_size, lang),
                    })}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
