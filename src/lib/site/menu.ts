import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/format";
import { isShowableLink, localizeHref } from "@/lib/routes";

/** A menu row as read from the database (pages joined; unpublished pages come back null). */
export type MenuRow = {
  id: number;
  parent_id: number | null;
  label_en: string;
  label_bn: string;
  url: string | null;
  page_id: number | null;
  page: {
    slug: string;
    is_published: boolean;
    has_content: boolean | null;
  } | null;
  sort_order: number;
};

export type MenuLink = {
  id: number;
  label: string;
  href: string;
  external: boolean;
};
export type MenuEntry = MenuLink & { children: MenuLink[] };

/** Where a row points, or null if it should not be shown (missing, unpublished or empty page; unbuilt route). */
function targetOf(row: MenuRow): string | null {
  if (row.page_id !== null) {
    return row.page?.is_published && row.page.has_content
      ? `/p/${row.page.slug}`
      : null;
  }
  return isShowableLink(row.url) ? row.url : null;
}

function toLink(row: MenuRow, target: string | null, lang: Locale): MenuLink {
  return {
    id: row.id,
    label: pickLocalized(row, "label", lang),
    href: target ? localizeHref(target, lang) : "",
    external: !!target && target.startsWith("https://"),
  };
}

/**
 * Builds the visible two-level menu. Children with nowhere to go are dropped; a top-level
 * menu is kept if it has its own link or at least one visible child.
 */
export function buildMenu(rows: readonly MenuRow[], lang: Locale): MenuEntry[] {
  const byOrder = (a: MenuRow, b: MenuRow) =>
    a.sort_order - b.sort_order || a.id - b.id;
  const tops = rows.filter((r) => r.parent_id === null).sort(byOrder);

  return tops.flatMap((top) => {
    const children = rows
      .filter((r) => r.parent_id === top.id)
      .sort(byOrder)
      .map((r) => ({ row: r, target: targetOf(r) }))
      .filter((c) => c.target !== null)
      .map((c) => toLink(c.row, c.target, lang));
    const target = targetOf(top);
    if (!target && children.length === 0) return [];
    return [{ ...toLink(top, target, lang), children }];
  });
}
