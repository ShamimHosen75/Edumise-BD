import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";

import { ContentHeader } from "@/components/site/content/content-header";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { TabLinks } from "@/components/site/content/tab-links";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { contentLabels } from "@/lib/content/labels";
import { parsePage, totalPages } from "@/lib/content/pagination";
import { formatDateTime, pickLocalized } from "@/lib/format";
import { listEvents } from "@/lib/site/content-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ when?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.content.events, description: dict.content.intro.events };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const page = parsePage(sp.page);
  const { rows, count } = await listEvents({ page, when });
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/events`;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.events} intro={c.intro.events} />
      <TabLinks
        label={c.events}
        tabs={(["upcoming", "past"] as const).map((value) => ({
          href: listHref(base, { when: value === "past" ? "past" : undefined }),
          label: value === "past" ? c.past : c.upcoming,
          active: when === value,
        }))}
      />
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {rows.map((e) => {
            const cover = publicMediaUrl(e.cover_path);
            const venue = pickLocalized(e, "venue", lang);
            return (
              <li
                key={e.id}
                className="bg-card flex flex-col overflow-hidden rounded-xl border sm:flex-row"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    width={320}
                    height={180}
                    sizes="(min-width: 640px) 240px, 100vw"
                    className="aspect-video w-full object-cover sm:w-60"
                  />
                ) : null}
                <div className="flex flex-col gap-2 p-4">
                  <h2 className="font-semibold">
                    <Link
                      href={`${base}/${e.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {pickLocalized(e, "title", lang)}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    <time dateTime={e.starts_at}>
                      {formatDateTime(e.starts_at, lang)}
                    </time>
                  </p>
                  {venue ? (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <MapPin className="size-4" aria-hidden="true" />
                      {venue}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {when === "past" ? c.noPast : c.noUpcoming}
        </p>
      )}
      <Pagination
        page={page}
        total={totalPages(count)}
        href={(n) =>
          listHref(base, {
            when: when === "past" ? "past" : undefined,
            page: n,
          })
        }
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
