import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";

/** Labels shared by the public list pages (toolbar, pagination, share, attachment). */
export function contentLabels(dict: Dictionary, lang: Locale) {
  const c = dict.content;
  return {
    toolbar: {
      search: c.search,
      searchLabel: c.searchLabel,
      category: c.category,
      allCategories: c.allCategories,
    },
    pagination: {
      nav: c.pagination,
      previous: c.previous,
      next: c.next,
      pageN: (n: number) =>
        t(dict, "content.pageN", { n: localizeDigits(n, lang) }),
    },
    digits: (n: number) => localizeDigits(n, lang),
    share: {
      share: c.share,
      facebook: c.shareFacebook,
      whatsapp: c.shareWhatsapp,
      x: c.shareX,
      copy: c.copyLink,
      copied: c.copied,
    },
    attachment: {
      attachment: c.attachment,
      download: c.download,
      openPdf: c.openPdf,
      pdfPreview: c.pdfPreview,
      pdfFallback: c.pdfFallback,
    },
    count: (n: number) =>
      t(dict, "content.resultCount", { count: localizeDigits(n, lang) }),
  };
}
