import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { fileTypeLabel } from "@/lib/files";
import { formatBytes, formatDate } from "@/lib/format";
import type { DownloadDetail } from "@/lib/site/content-data";

/** Category, type, size and date of a download, as a small definition list. */
export function DownloadMeta({
  item,
  lang,
  dict,
}: {
  item: DownloadDetail;
  lang: Locale;
  dict: Dictionary;
}) {
  const c = dict.content;
  const category =
    c.downloadCategories[item.category as keyof typeof c.downloadCategories] ??
    item.category;
  const type = fileTypeLabel(item.mime_type);
  const entries: [string, string][] = [
    [c.category, category],
    ...(type ? ([[c.type, type]] as [string, string][]) : []),
    ...(item.file_size !== null
      ? ([[c.size, formatBytes(item.file_size, lang)]] as [string, string][])
      : []),
  ];
  return (
    <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {entries.map(([term, value]) => (
        <div key={term} className="flex gap-1">
          <dt>{term}:</dt>
          <dd className="text-foreground">{value}</dd>
        </div>
      ))}
      {item.published_at ? (
        <div className="flex gap-1">
          <dt className="sr-only">{c.date}</dt>
          <dd>
            <time dateTime={item.published_at}>
              {formatDate(item.published_at, lang, "medium")}
            </time>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
