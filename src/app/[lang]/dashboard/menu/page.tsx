import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  MenuBuilder,
  type BuilderItem,
} from "@/components/dashboard/cms/menu-builder";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { cmsMessages } from "@/lib/cms-messages";
import { pickLocalized } from "@/lib/format";
import { buildMenu, type MenuRow } from "@/lib/site/menu";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).cms.menuTitle }
    : {};
}

export default async function MenuPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  const c = dict.cms;

  const supabase = await createClient();
  const [{ data: rows }, { data: pages }] = await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, parent_id, label_en, label_bn, url, page_id, sort_order, is_hidden, page:pages(slug, is_published, has_content)",
      )
      .order("sort_order")
      .order("id"),
    supabase
      .from("pages")
      .select("id, slug, title_en, title_bn, is_published")
      .order("title_en"),
  ]);
  const all = (rows ?? []) as (MenuRow & { is_hidden: boolean })[];
  // What the site would show: hidden items removed, then the normal visibility rules.
  const shownIds = new Set(
    buildMenu(
      all.filter((r) => !r.is_hidden),
      lang,
    ).flatMap((e) => [e.id, ...e.children.map((ch) => ch.id)]),
  );
  const pageLabel = new Map(
    (pages ?? []).map((p) => [
      p.id,
      `${pickLocalized(p, "title", lang)} (/p/${p.slug})`,
    ]),
  );

  const items: BuilderItem[] = all.map((r) => ({
    id: r.id,
    parent_id: r.parent_id,
    label: pickLocalized(r, "label", lang),
    hidden: r.is_hidden,
    shown: shownIds.has(r.id),
    linkText: r.page_id
      ? `${c.page}: ${pageLabel.get(r.page_id) ?? "—"}`
      : r.url
        ? `${c.url}: ${r.url}`
        : c.linkNone,
    values: {
      parent_id: r.parent_id,
      label_en: r.label_en,
      label_bn: r.label_bn,
      link_type: r.page_id ? "page" : r.url ? "url" : "none",
      page_id: r.page_id,
      url: r.url ?? "",
      is_hidden: r.is_hidden,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{c.menuTitle}</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">{c.menuIntro}</p>
      </div>
      <MenuBuilder
        lang={lang}
        items={items}
        messages={cmsMessages(dict)}
        pages={(pages ?? []).map((p) => ({
          id: p.id,
          label: pageLabel.get(p.id)!,
        }))}
      />
    </div>
  );
}
