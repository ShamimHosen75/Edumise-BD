import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoGallery } from "@/components/site/content/photo-gallery";
import { ShareButtons } from "@/components/site/content/share-buttons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import { getAlbum } from "@/lib/site/content-data";
import { detailMetadata } from "@/lib/site/detail-metadata";
import { lightboxLabels, toPhotos } from "@/lib/site/photos";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; slug: string }> };

// Five minutes: an item scheduled for later appears soon after its time.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const album = await getAlbum(slug);
  if (!album) return {};
  return detailMetadata({
    lang,
    path: `/gallery/${slug}`,
    title: pickLocalized(album, "title", lang),
    image: publicMediaUrl(album.cover_path),
  });
}

export default async function AlbumPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const album = await getAlbum(slug);
  if (!album) notFound();
  const dict = await getDictionary(lang);
  const labels = contentLabels(dict, lang);
  const title = pickLocalized(album, "title", lang);
  const photos = toPhotos(album.gallery_images, dict, lang);

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-10">
      <Link
        href={`/${lang}/gallery`}
        className="text-primary text-sm hover:underline"
      >
        <span aria-hidden="true">←</span>{" "}
        {t(dict, "content.allItems", { section: dict.content.gallery })}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground text-sm">
          {t(dict, "content.photoCount", {
            count: localizeDigits(photos.length, lang),
          })}
          {album.event_date ? ` · ${formatDate(album.event_date, lang)}` : ""}
        </p>
      </header>
      {photos.length > 0 ? (
        <PhotoGallery photos={photos} labels={lightboxLabels(dict)} />
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {dict.content.noResults}
        </p>
      )}
      <ShareButtons title={title} labels={labels.share} />
    </article>
  );
}
