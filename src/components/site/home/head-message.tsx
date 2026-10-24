import Image from "next/image";
import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { pickLocalized } from "@/lib/format";
import type { SchoolSettings } from "@/lib/settings";
import { publicMediaUrl } from "@/lib/supabase/public";

import { Section } from "./section";

/** Head teacher's message (from settings). "Read more" links to the CMS page when it is published. */
export function HeadMessage({
  lang,
  dict,
  settings,
  fullMessageHref,
}: {
  lang: Locale;
  dict: Dictionary;
  settings: SchoolSettings | null;
  fullMessageHref: string | null;
}) {
  const message = settings ? pickLocalized(settings, "head_message", lang) : "";
  if (!settings || !message) return null;
  const name = pickLocalized(settings, "head_name", lang);
  const photo = publicMediaUrl(settings.head_photo_path);

  return (
    <Section id="head-message" title={dict.site.home.headMessage}>
      <figure className="bg-card flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-start">
        {photo ? (
          <Image
            src={photo}
            alt={t(dict, "site.home.headPhotoAlt", { name })}
            width={160}
            height={160}
            className="size-32 shrink-0 rounded-xl object-cover sm:size-40"
          />
        ) : null}
        <div className="flex flex-col gap-3">
          <blockquote className="text-base leading-relaxed whitespace-pre-line">
            {message}
          </blockquote>
          <figcaption className="text-sm">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground">
              {" "}
              · {dict.site.home.headTeacher}
            </span>
          </figcaption>
          {fullMessageHref ? (
            <Link
              href={fullMessageHref}
              className="text-primary text-sm font-medium hover:underline"
            >
              {dict.site.home.readMore}
            </Link>
          ) : null}
        </div>
      </figure>
    </Section>
  );
}
