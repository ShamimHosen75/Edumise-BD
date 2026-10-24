import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import {
  ContentTable,
  type ContentRow,
} from "@/components/dashboard/content/content-table";
import { ListToolbar } from "@/components/site/content/list-toolbar";
import { listHref, Pagination } from "@/components/site/content/pagination";
import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { contentLabels } from "@/lib/content/labels";
import {
  canPublish,
  isContentModule,
  MODULE_ROLES,
  MODULE_TABLE,
} from "@/lib/content/modules";
import { pageRange, parsePage, totalPages } from "@/lib/content/pagination";
import { cleanSearch } from "@/lib/content/share";
import { localizeDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string; module: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

const STATUSES = ["draft", "scheduled", "published"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, module } = await params;
  if (!isLocale(lang) || !isContentModule(module)) return {};
  return { title: (await getDictionary(lang)).content[module] };
}

export default async function ContentList({ params, searchParams }: Props) {
  const { lang, module } = await params;
  if (!isLocale(lang) || !isContentModule(module)) notFound();
  const user = await requireRole(lang, MODULE_ROLES[module]);
  const dict = await getDictionary(lang);
  const a = dict.contentAdmin;
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const page = parsePage(sp.page);
  const { from, to } = pageRange(page);

  // Untyped: the table is chosen at run time. RLS limits what each role sees.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const cols = [
    "id, title_en, title_bn, is_published, published_at, updated_at",
    module === "downloads" ? "" : ", slug",
    module === "events" ? ", starts_at" : "",
  ].join("");
  let query = supabase
    .from(MODULE_TABLE[module])
    .select(cols, { count: "exact" });
  // Teachers manage only their own notices.
  if (!canPublish(user.role)) query = query.eq("created_by", user.id);
  const now = new Date().toISOString();
  if (status === "draft") query = query.eq("is_published", false);
  if (status === "scheduled")
    query = query.eq("is_published", true).gt("published_at", now);
  if (status === "published")
    query = query.eq("is_published", true).lte("published_at", now);
  if (q) query = query.or(`title_en.ilike.%${q}%,title_bn.ilike.%${q}%`);
  const { data, count } = await query
    .order(module === "events" ? "starts_at" : "updated_at", {
      ascending: false,
    })
    .range(from, to);
  const rows = (data ?? []) as unknown as ContentRow[];
  const labels = contentLabels(dict, lang);
  const base = `/${lang}/dashboard/${module}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{dict.content[module]}</h1>
          {!canPublish(user.role) ? (
            <p className="text-muted-foreground text-sm">{a.draftOnly}</p>
          ) : null}
        </div>
        <Button asChild>
          <Link href={`${base}/new`}>
            <Plus aria-hidden="true" />
            {a.addNew}
          </Link>
        </Button>
      </div>
      <ListToolbar
        action={base}
        q={q}
        category={status}
        categories={STATUSES.map((s) => ({ value: s, label: a[s] }))}
        labels={{ ...labels.toolbar, category: a.status, allCategories: a.all }}
        filterName="status"
      />
      <p className="text-muted-foreground text-sm" role="status">
        {t(dict, "contentAdmin.count", {
          count: localizeDigits(count ?? 0, lang),
        })}
      </p>
      <ContentTable
        lang={lang}
        dict={dict}
        module={module}
        rows={rows}
        canEdit={(r) => canPublish(user.role) || !r.is_published}
      />
      <Pagination
        page={page}
        total={totalPages(count ?? 0)}
        href={(n) => listHref(base, { q, status, page: n })}
        labels={labels.pagination}
        digits={labels.digits}
      />
    </div>
  );
}
