import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip, Pin } from "lucide-react";

import { ContentHeader } from "@/components/site/content/content-header";
import { ListToolbar } from "@/components/site/content/list-toolbar";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { contentLabels } from "@/lib/content/labels";
import { parsePage, totalPages } from "@/lib/content/pagination";
import { cleanSearch } from "@/lib/content/share";
import { formatDate, pickLocalized } from "@/lib/format";
import { listNotices } from "@/lib/site/content-data";
import { NOTICE_CATEGORIES } from "@/lib/validation/content";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.content.notices,
    description: dict.content.intro.notices,
  };
}

export default async function NoticesPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const category = NOTICE_CATEGORIES.find((x) => x === sp.category) ?? "";
  const page = parsePage(sp.page);
  const { rows, count } = await listNotices({ q, page, category });
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/notices`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.notices} intro={c.intro.notices} />
      <ListToolbar
        action={base}
        q={q}
        category={category}
        categories={NOTICE_CATEGORIES.map((v) => ({
          value: v,
          label: c.categories[v],
        }))}
        labels={labels.toolbar}
      />
      <p role="status" className="text-muted-foreground text-sm">
        {labels.count(count)}
      </p>
      {rows.length > 0 ? (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4"
            >
              {n.published_at ? (
                <time
                  dateTime={n.published_at}
                  className="text-muted-foreground w-28 shrink-0 text-xs"
                >
                  {formatDate(n.published_at, lang, "medium")}
                </time>
              ) : null}
              <div className="min-w-0 flex-1">
                <Link
                  href={`${base}/${n.slug}`}
                  className="hover:text-primary font-medium hover:underline"
                >
                  {pickLocalized(n, "title", lang)}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="bg-muted rounded-full px-2 py-0.5">
                    {c.categories[n.category]}
                  </span>
                  {n.is_pinned ? (
                    <span className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2 py-0.5">
                      <Pin className="size-3" aria-hidden="true" />
                      {c.pinned}
                    </span>
                  ) : null}
                  {n.attachment_path ? (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Paperclip className="size-3" aria-hidden="true" />
                      {c.attachment}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {c.noResults}
        </p>
      )}
      <Pagination
        page={page}
        total={totalPages(count)}
        href={(n) => listHref(base, { q, category, page: n })}
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
