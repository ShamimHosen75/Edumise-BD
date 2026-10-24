import Link from "next/link";
import { Pin } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate, pickLocalized } from "@/lib/format";
import { isAvailableRoute, localizeHref } from "@/lib/routes";

import { Section } from "./section";

export type NoticeRow = {
  id: number;
  slug: string;
  title_en: string;
  title_bn: string;
  is_pinned: boolean;
  published_at: string | null;
};

/** Latest 5 public notices. Titles link to the notice page once it exists (Step 2.3). */
export function LatestNotices({
  lang,
  dict,
  notices,
}: {
  lang: Locale;
  dict: Dictionary;
  notices: NoticeRow[];
}) {
  if (notices.length === 0) return null;
  return (
    <Section id="notices" title={dict.site.home.latestNotices}>
      <ul className="bg-card divide-y rounded-xl border">
        {notices.map((n) => {
          const path = `/notices/${n.slug}`;
          const title = pickLocalized(n, "title", lang);
          return (
            <li key={n.id} className="flex items-start gap-3 p-4">
              {n.published_at ? (
                <time
                  dateTime={n.published_at}
                  className="text-muted-foreground w-24 shrink-0 text-xs"
                >
                  {formatDate(n.published_at, lang, "medium")}
                </time>
              ) : null}
              <p className="min-w-0 flex-1 text-sm font-medium">
                {isAvailableRoute(path) ? (
                  <Link
                    href={localizeHref(path, lang)}
                    className="hover:text-primary hover:underline"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </p>
              {n.is_pinned ? (
                <span className="bg-primary/10 text-primary flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                  <Pin className="size-3" aria-hidden="true" />
                  {dict.site.home.pinned}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
