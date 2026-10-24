import Link from "next/link";
import {
  Building,
  ExternalLink,
  GraduationCap,
  Landmark,
  Link as LinkIcon,
  LogIn,
  type LucideIcon,
} from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { isExternal, isShowableLink, localizeHref } from "@/lib/routes";

import { Section } from "./section";

const ICONS: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  building: Building,
  "log-in": LogIn,
  link: LinkIcon,
};

export type QuickLinkRow = {
  id: number;
  label_en: string;
  label_bn: string;
  url: string;
  icon: string;
};

export function QuickLinks({
  lang,
  dict,
  links,
}: {
  lang: Locale;
  dict: Dictionary;
  links: QuickLinkRow[];
}) {
  const shown = links.filter((l) => isShowableLink(l.url));
  if (shown.length === 0) return null;
  const card =
    "flex h-full items-center gap-3 rounded-xl border bg-card p-3 text-sm font-medium hover:border-primary hover:text-primary";
  return (
    <Section id="quick-links" title={dict.site.home.quickLinks}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((l) => {
          const Icon = ICONS[l.icon] ?? LinkIcon;
          const body = (
            <>
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                {pickLocalized(l, "label", lang)}
              </span>
            </>
          );
          return (
            <li key={l.id}>
              {isExternal(l.url) ? (
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={card}
                >
                  {body}
                  <ExternalLink
                    className="text-muted-foreground size-4 shrink-0"
                    aria-label={dict.site.home.opensNewTab}
                  />
                </a>
              ) : (
                <Link href={localizeHref(l.url, lang)} className={card}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
