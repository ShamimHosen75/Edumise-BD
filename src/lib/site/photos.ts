import type { Photo } from "@/components/site/content/photo-gallery";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits, pickLocalized } from "@/lib/format";
import { publicMediaUrl } from "@/lib/supabase/public";

import type { AlbumImage } from "./content-data";

/** Album images in display order, as lightbox photos with labels in the reader's language. */
export function toPhotos(
  images: AlbumImage[],
  dict: Dictionary,
  lang: Locale,
): Photo[] {
  const shown = [...images]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .flatMap((img) => {
      const src = publicMediaUrl(img.image_path);
      return src ? [{ img, src }] : [];
    });
  const total = localizeDigits(shown.length, lang);
  return shown.map(({ img, src }, i) => {
    const caption = pickLocalized(img, "caption", lang);
    const position = t(dict, "content.photoOf", {
      n: localizeDigits(i + 1, lang),
      total,
    });
    return {
      id: img.id,
      src,
      caption,
      openLabel: t(dict, "content.openPhoto", { caption: caption || position }),
      positionLabel: position,
    };
  });
}

export const lightboxLabels = (dict: Dictionary) => ({
  close: dict.content.close,
  previous: dict.content.prevPhoto,
  next: dict.content.nextPhoto,
});
