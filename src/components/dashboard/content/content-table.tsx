import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  contentStatus,
  publicPath,
  type ContentModule,
} from "@/lib/content/modules";
import { formatDate, pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ContentRow = {
  id: number;
  slug?: string;
  title_en: string;
  title_bn: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
  starts_at?: string;
};

const BADGE = {
  draft: "bg-muted",
  scheduled:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  published: "bg-primary/10 text-primary",
} as const;

/** Dashboard list of a module's items with status, date and edit / view links. */
export function ContentTable({
  lang,
  dict,
  module,
  rows,
  canEdit,
}: {
  lang: Locale;
  dict: Dictionary;
  module: ContentModule;
  rows: ContentRow[];
  canEdit: (row: ContentRow) => boolean;
}) {
  const a = dict.contentAdmin;
  if (rows.length === 0)
    return (
      <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
        {a.empty}
      </p>
    );
  const link = "text-primary underline-offset-4 hover:underline";
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="p-3 font-medium">
              {a.colTitle}
            </th>
            <th scope="col" className="p-3 font-medium">
              {a.status}
            </th>
            <th scope="col" className="p-3 font-medium">
              {a.colDate}
            </th>
            <th scope="col" className="p-3 font-medium">
              {a.colActions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const title = pickLocalized(r, "title", lang);
            const status = contentStatus(r.is_published, r.published_at);
            const date = r.starts_at ?? r.published_at ?? r.updated_at;
            return (
              <tr key={r.id}>
                <td className="p-3 font-medium">{title}</td>
                <td className="p-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      BADGE[status],
                    )}
                  >
                    {a[status]}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  <time dateTime={date}>
                    {formatDate(date, lang, "medium")}
                  </time>
                </td>
                <td className="p-3">
                  <div className="flex gap-3">
                    {canEdit(r) ? (
                      <Link
                        href={`/${lang}/dashboard/${module}/${r.id}`}
                        className={link}
                      >
                        {a.edit}
                        <span className="sr-only">: {title}</span>
                      </Link>
                    ) : null}
                    {status === "published" ? (
                      <Link
                        href={`/${lang}${publicPath(module, r)}`}
                        className={link}
                      >
                        {a.view}
                        <span className="sr-only">: {title}</span>
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
