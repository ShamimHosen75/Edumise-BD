import Link from "next/link";
import { Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

import { FacebookIcon, YoutubeIcon } from "@/components/site/social-icons";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { formatNumber, localizeDigits, pickLocalized } from "@/lib/format";
import { isExternal, isShowableLink, localizeHref } from "@/lib/routes";
import type { SchoolSettings } from "@/lib/settings";

type Link = { id: number; label_en: string; label_bn: string; url: string };
type Props = {
  lang: Locale;
  dict: Dictionary;
  settings: SchoolSettings | null;
  name: string;
  links: Link[];
};

export function SiteFooter({ lang, dict, settings, name, links }: Props) {
  const f = dict.site.footer;
  const shown = links.filter((l) => isShowableLink(l.url));
  const social = [
    { url: settings?.facebook_url, label: "Facebook", Icon: FacebookIcon },
    { url: settings?.youtube_url, label: "YouTube", Icon: YoutubeIcon },
  ].filter((s) => s.url);
  const year = formatNumber(new Date().getFullYear(), lang, {
    grouping: false,
  });
  const heading =
    "mb-3 text-sm font-semibold tracking-wide text-white uppercase";

  return (
    <footer className="mt-12 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-2 text-lg font-bold text-white">{name}</p>
          {settings ? (
            <p className="flex gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{pickLocalized(settings, "address", lang)}</span>
            </p>
          ) : null}
        </div>
        <div>
          <h2 className={heading}>{f.contact}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {settings?.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="size-4" aria-hidden="true" />
                <span className="sr-only">{f.phone}:</span>
                <a
                  href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                  className="hover:text-white hover:underline"
                >
                  {localizeDigits(settings.phone, lang)}
                </a>
              </li>
            ) : null}
            {settings?.email ? (
              <li className="flex items-center gap-2">
                <Mail className="size-4" aria-hidden="true" />
                <span className="sr-only">{f.email}:</span>
                <a
                  href={`mailto:${settings.email}`}
                  className="break-all hover:text-white hover:underline"
                >
                  {settings.email}
                </a>
              </li>
            ) : null}
            {settings && pickLocalized(settings, "office_hours", lang) ? (
              <li className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">{f.officeHours}:</span>
                <span>
                  {localizeDigits(
                    pickLocalized(settings, "office_hours", lang),
                    lang,
                  )}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
        {shown.length > 0 ? (
          <div>
            <h2 className={heading}>{f.links}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {shown.map((l) =>
                isExternal(l.url) ? (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white hover:underline"
                    >
                      {pickLocalized(l, "label", lang)}
                      <ExternalLink
                        className="ml-1 inline size-3"
                        aria-label={dict.site.home.opensNewTab}
                      />
                    </a>
                  </li>
                ) : (
                  <li key={l.id}>
                    <Link
                      href={localizeHref(l.url, lang)}
                      className="hover:text-white hover:underline"
                    >
                      {pickLocalized(l, "label", lang)}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}
        {social.length > 0 ? (
          <div>
            <h2 className={heading}>{f.follow}</h2>
            <ul className="flex gap-3">
              {social.map(({ url, label, Icon }) => (
                <li key={label}>
                  <a
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(dict, "site.topBar.social", {
                      network: label,
                    })}
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:text-white"
                  >
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:justify-between">
          <p>{t(dict, "site.footer.copyright", { year, school: name })}</p>
          <p>{f.poweredBy}</p>
        </div>
      </div>
    </footer>
  );
}
