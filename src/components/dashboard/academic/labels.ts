import type { DataTableLabels } from "@/components/ui/data-table";
import type { Locale } from "@/i18n/config";
import { msg, type Messages } from "@/i18n/messages";
import { localizeDigits } from "@/lib/format";

/** A translator for client components: key (+ {placeholders}) -> text. */
export function translator(messages: Messages) {
  return (key: string | undefined, vars?: Record<string, string | number>) => {
    // No key (no error on a field) -> no text.
    if (!key) return "";
    const text = msg(messages, key) ?? key;
    return vars
      ? text.replace(/\{(\w+)\}/g, (m, name: string) =>
          name in vars ? String(vars[name]) : m,
        )
      : text;
  };
}

export type Translate = ReturnType<typeof translator>;

/** DataTable labels in the reader's language (with Bangla digits in bn). */
export function tableLabels(tr: Translate, lang: Locale): DataTableLabels {
  const n = (v: number) => localizeDigits(v, lang);
  return {
    search: tr("table.search"),
    all: tr("table.all"),
    empty: tr("table.empty"),
    noMatches: tr("table.noMatches"),
    exportCsv: tr("table.exportCsv"),
    previous: tr("table.previous"),
    next: tr("table.next"),
    actions: tr("table.actions"),
    pageOf: (page, pages) =>
      tr("table.pageOf", { page: n(page), pages: n(pages) }),
    count: (count) => tr("table.count", { count: n(count) }),
    sortBy: (column) => tr("table.sortBy", { column }),
  };
}

export const dialogLabels = (tr: Translate) => ({
  save: tr("dialog.save"),
  saving: tr("dialog.saving"),
  cancel: tr("dialog.cancel"),
  close: tr("dialog.close"),
});
