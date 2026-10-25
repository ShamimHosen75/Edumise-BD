import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { formatDate, formatNumber, pickLocalized } from "@/lib/format";
import { requireRole } from "@/lib/auth/session";
import { cleanSearch } from "@/lib/content/share";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).cms.pagesTitle }
    : {};
}

const STATUSES = ["all", "published", "draft"] as const;

export default async function PagesList({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const c = dict.cms;
  const { q, status: rawStatus } = await searchParams;
  const status = STATUSES.find((s) => s === rawStatus) ?? "all";
  const search = cleanSearch(q);

  const supabase = await createClient();
  let query = supabase
    .from("pages")
    .select(
      "id, slug, title_en, title_bn, is_published, has_content, updated_at",
    )
    .order("title_en");
  if (status !== "all")
    query = query.eq("is_published", status === "published");
  if (search)
    query = query.or(
      `title_en.ilike.%${search}%,title_bn.ilike.%${search}%,slug.ilike.%${search}%`,
    );
  const { data: pages, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.pagesTitle}</h1>
          <p className="text-muted-foreground text-sm">{c.pagesIntro}</p>
        </div>
        <Button asChild>
          <Link href={`/${lang}/dashboard/pages/new`}>
            <Plus aria-hidden="true" />
            {c.newPage}
          </Link>
        </Button>
      </div>

      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        action={`/${lang}/dashboard/pages`}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">{c.searchLabel}</Label>
          <Input id="q" name="q" type="search" defaultValue={search} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">{c.status}</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {c[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          <Search aria-hidden="true" />
          {c.search}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm" role="status">
        {t(dict, "cms.count", {
          count: formatNumber(pages?.length ?? 0, lang),
        })}
      </p>

      {pages && pages.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  {c.colTitle}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {c.colAddress}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {c.status}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {c.colUpdated}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {c.colActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pages.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-medium">
                    {pickLocalized(p, "title", lang)}
                  </td>
                  <td className="p-3 font-mono text-xs">/p/{p.slug}</td>
                  <td className="p-3">
                    <span
                      className={
                        p.is_published
                          ? "bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                          : "bg-muted rounded-full px-2 py-0.5 text-xs"
                      }
                    >
                      {p.is_published ? c.published : c.draft}
                    </span>
                    {!p.has_content ? (
                      <span className="bg-muted ml-1 rounded-full px-2 py-0.5 text-xs">
                        {c.empty}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs">
                    {formatDate(p.updated_at, lang, "medium")}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/${lang}/dashboard/pages/${p.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.edit}
                        <span className="sr-only">
                          : {pickLocalized(p, "title", lang)}
                        </span>
                      </Link>
                      {p.is_published && p.has_content ? (
                        <Link
                          href={`/${lang}/p/${p.slug}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {c.view}
                          <span className="sr-only">
                            : {pickLocalized(p, "title", lang)}
                          </span>
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {c.noPages}
        </p>
      )}
    </div>
  );
}
