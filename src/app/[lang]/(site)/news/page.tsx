import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentHeader } from "@/components/site/content/content-header";
import { ListToolbar } from "@/components/site/content/list-toolbar";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { excerpt } from "@/lib/content/excerpt";
import { contentLabels } from "@/lib/content/labels";
import { parsePage, totalPages } from "@/lib/content/pagination";
import { cleanSearch } from "@/lib/content/share";
import { formatDate, pickLocalized } from "@/lib/format";
import { listNews } from "@/lib/site/content-data";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.content.news, description: dict.content.intro.news };
}

export default async function NewsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const { rows, count } = await listNews({ q, page });
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/news`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.news} intro={c.intro.news} />
      <ListToolbar action={base} q={q} labels={labels.toolbar} />
      <p role="status" className="text-muted-foreground text-sm">
        {labels.count(count)}
      </p>
      {rows.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((n) => {
            const cover = publicMediaUrl(n.cover_path);
            const title = pickLocalized(n, "title", lang);
            return (
              <li
                key={n.id}
                className="bg-card flex flex-col overflow-hidden rounded-xl border"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    width={480}
                    height={270}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="aspect-video w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {n.published_at ? (
                    <time
                      dateTime={n.published_at}
                      className="text-muted-foreground text-xs"
                    >
                      {formatDate(n.published_at, lang, "medium")}
                    </time>
                  ) : null}
                  <h2 className="font-semibold">
                    <Link
                      href={`${base}/${n.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {title}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {excerpt(pickLocalized(n, "body", lang), 120)}
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
        href={(n) => listHref(base, { q, page: n })}
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
