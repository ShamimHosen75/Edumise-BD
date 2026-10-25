import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";

import { ContentHeader } from "@/components/site/content/content-header";
import { DownloadMeta } from "@/components/site/content/download-meta";
import { ListToolbar } from "@/components/site/content/list-toolbar";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageAlternates } from "@/lib/site/detail-metadata";
import { t } from "@/i18n/t";
import { contentLabels } from "@/lib/content/labels";
import { lastPage, parsePage, totalPages } from "@/lib/content/pagination";
import { cleanSearch } from "@/lib/content/share";
import { pickLocalized } from "@/lib/format";
import { listDownloads } from "@/lib/site/content-data";
import { publicDownloadUrl } from "@/lib/supabase/public";
import { DOWNLOAD_CATEGORIES } from "@/lib/validation/content";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    alternates: pageAlternates(lang, "/downloads"),
    title: dict.content.downloads,
    description: dict.content.intro.downloads,
  };
}

export default async function DownloadsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.content;
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const category = DOWNLOAD_CATEGORIES.find((x) => x === sp.category) ?? "";
  const page = parsePage(sp.page);
  const { rows, count } = await listDownloads({ q, page, category });
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/downloads`;
  // A page past the end (old link, fewer results) goes to the last page.
  if (page > lastPage(count))
    redirect(listHref(base, { q, category, page: lastPage(count) }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <ContentHeader title={c.downloads} intro={c.intro.downloads} />
      <ListToolbar
        action={base}
        q={q}
        category={category}
        categories={DOWNLOAD_CATEGORIES.map((v) => ({
          value: v,
          label: c.downloadCategories[v],
        }))}
        labels={labels.toolbar}
      />
      <p role="status" className="text-muted-foreground text-sm">
        {labels.count(count)}
      </p>
      {rows.length > 0 ? (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((d) => {
            const title = pickLocalized(d, "title", lang);
            const file = publicDownloadUrl(d.file_path);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <FileText
                  className="text-primary size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`${base}/${d.id}`}
                    className="hover:text-primary font-medium hover:underline"
                  >
                    {title}
                  </Link>
                  <DownloadMeta item={d} lang={lang} dict={dict} />
                </div>
                {file ? (
                  <a
                    href={file}
                    download
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    aria-label={t(dict, "content.downloadItem", { title })}
                  >
                    <Download aria-hidden="true" />
                    {c.download}
                  </a>
                ) : null}
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
        href={(n) => listHref(base, { q, category, page: n })}
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
