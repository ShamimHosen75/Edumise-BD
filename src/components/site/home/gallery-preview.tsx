import Image from "next/image";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { pickLocalized } from "@/lib/format";
import { publicMediaUrl } from "@/lib/supabase/public";

import { Section } from "./section";

export type GalleryRow = {
  id: number;
  image_path: string;
  caption_en: string;
  caption_bn: string;
};

/** Latest photos from published albums (album visibility is enforced by RLS). */
export function GalleryPreview({
  lang,
  dict,
  images,
}: {
  lang: Locale;
  dict: Dictionary;
  images: GalleryRow[];
}) {
  const shown = images.flatMap((img) => {
    const src = publicMediaUrl(img.image_path);
    return src ? [{ ...img, src }] : [];
  });
  if (shown.length === 0) return null;
  return (
    <Section
      id="gallery"
      title={dict.site.home.gallery}
      more={{
        href: `/${lang}/gallery`,
        label: t(dict, "content.allItems", { section: dict.content.gallery }),
      }}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((img) => {
          const caption = pickLocalized(img, "caption", lang);
          return (
            <li key={img.id}>
              <figure className="bg-card overflow-hidden rounded-xl border">
                <Image
                  src={img.src}
                  alt={caption}
                  width={400}
                  height={300}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="aspect-[4/3] w-full object-cover"
                />
                {caption ? (
                  <figcaption className="px-3 py-2 text-xs">
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
