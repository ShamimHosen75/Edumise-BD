import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";

import { PhotoGallery } from "@/components/site/content/photo-gallery";
import { ShareButtons } from "@/components/site/content/share-buttons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { formatDateTime, pickLocalized } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { getEvent } from "@/lib/site/content-data";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { lightboxLabels, toPhotos } from "@/lib/site/photos";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const event = await getEvent(slug);
  if (!event) return {};
  return detailMetadata({
    lang,
    path: `/events/${slug}`,
    title: pickLocalized(event, "title", lang),
    bodyHtml: pickLocalized(event, "body", lang),
    image: publicMediaUrl(event.cover_path),
  });
}

export default async function EventPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const event = await getEvent(slug);
  if (!event) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const labels = contentLabels(dict, lang);
  const title = pickLocalized(event, "title", lang);
  const venue = pickLocalized(event, "venue", lang);
  const cover = publicMediaUrl(event.cover_path);
  const html = sanitizeRichText(pickLocalized(event, "body", lang), {
    mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  // The album shows only when it is published (RLS hides drafts, so album is null).
  const photos = event.album
    ? toPhotos(event.album.gallery_images, dict, lang)
    : [];

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10">
      <Link
        href={`/${lang}/events`}
        className="text-primary text-sm hover:underline"
      >
        ← {t(dict, "content.allItems", { section: c.events })}
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <dt>
              <CalendarDays
                className="text-primary mt-0.5 size-4"
                aria-hidden="true"
              />
              <span className="sr-only">{c.when}</span>
            </dt>
            <dd>
              <time dateTime={event.starts_at}>
                {formatDateTime(event.starts_at, lang)}
              </time>
              {event.ends_at ? (
                <>
                  {" – "}
                  <time dateTime={event.ends_at}>
                    {formatDateTime(event.ends_at, lang)}
                  </time>
                </>
              ) : null}
            </dd>
          </div>
          {venue ? (
            <div className="flex items-start gap-2">
              <dt>
                <MapPin
                  className="text-primary mt-0.5 size-4"
                  aria-hidden="true"
                />
                <span className="sr-only">{c.venue}</span>
              </dt>
              <dd>{venue}</dd>
            </div>
          ) : null}
        </dl>
      </header>
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={960}
          height={540}
          priority
          sizes="(min-width: 896px) 896px, 100vw"
          className="aspect-video w-full rounded-xl object-cover"
        />
      ) : null}
      {html ? (
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null}
      {photos.length > 0 ? (
        <section aria-labelledby="photos-title" className="flex flex-col gap-3">
          <h2 id="photos-title" className="text-lg font-semibold">
            {c.photos}
          </h2>
          <PhotoGallery photos={photos} labels={lightboxLabels(dict)} />
        </section>
      ) : null}
      <ShareButtons title={title} labels={labels.share} />
    </article>
  );
}
