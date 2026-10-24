import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Images } from "lucide-react";

import { ContentHeader } from "@/components/site/content/content-header";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { parsePage, totalPages } from "@/lib/content/pagination";
import { formatDate, localizeDigits, pickLocalized } from "@/lib/format";
import { listAlbums } from "@/lib/site/content-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.content.gallery,
    description: dict.content.intro.gallery,
  };
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const page = parsePage((await searchParams).page);
  const { rows, count } = await listAlbums({ page });
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/gallery`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.gallery} intro={c.intro.gallery} />
      {rows.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => {
            const cover = publicMediaUrl(a.cover_path);
            return (
              <li
                key={a.id}
                className="bg-card group relative overflow-hidden rounded-xl border"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    width={480}
                    height={360}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex aspect-[4/3] items-center justify-center">
                    <Images
                      className="text-muted-foreground size-10"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1 p-4">
                  <h2 className="font-semibold">
                    {/* The link covers the whole card (after: pseudo-element). */}
                    <Link
                      href={`${base}/${a.slug}`}
                      className="group-hover:underline after:absolute after:inset-0"
                    >
                      {pickLocalized(a, "title", lang)}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {t(dict, "content.photoCount", {
                      count: localizeDigits(a.photos, lang),
                    })}
                    {a.event_date
                      ? ` · ${formatDate(a.event_date, lang, "medium")}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {c.noResults}
        </p>
      )}
      <Pagination
        page={page}
        total={totalPages(count)}
        href={(n) => listHref(base, { page: n })}
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
