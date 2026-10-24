import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { LanguageSwitch } from "@/components/site/language-switch";
import { FacebookIcon, YoutubeIcon } from "@/components/site/social-icons";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { localizeDigits } from "@/lib/format";
import { isAvailableRoute } from "@/lib/routes";
import type { SchoolSettings } from "@/lib/settings";

type Props = {
  lang: Locale;
  dict: Dictionary;
  settings: SchoolSettings | null;
};

export function TopBar({ lang, dict, settings }: Props) {
  const social = [
    { url: settings?.facebook_url, name: "Facebook", Icon: FacebookIcon },
    { url: settings?.youtube_url, name: "YouTube", Icon: YoutubeIcon },
  ].filter((s) => s.url);

  return (
    <div
      className="bg-primary text-primary-foreground text-sm"
      aria-label={dict.site.topBar.label}
      role="region"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-4">
          {settings?.phone ? (
            <a
              href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-1.5 hover:underline"
            >
              <Phone className="size-4" aria-hidden="true" />
              <span>{localizeDigits(settings.phone, lang)}</span>
            </a>
          ) : null}
          {settings?.email ? (
            <a
              href={`mailto:${settings.email}`}
              className="hidden items-center gap-1.5 hover:underline sm:flex"
            >
              <Mail className="size-4" aria-hidden="true" />
              <span>{settings.email}</span>
            </a>
          ) : null}
          {social.map(({ url, name, Icon }) => (
            <a
              key={name}
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(dict, "site.topBar.social", { network: name })}
              className="rounded-sm p-1 hover:bg-white/15"
            >
              <Icon className="size-4" />
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch
            current={lang}
            label={dict.common.changeLanguage}
            className="text-primary-foreground hover:text-primary-foreground h-7 border-white/40 bg-transparent hover:bg-white/15"
          />
          {isAvailableRoute("/admission/apply") ? (
            <Button asChild size="sm" variant="secondary" className="h-7">
              <Link href={`/${lang}/admission/apply`}>
                {dict.site.topBar.applyOnline}
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="secondary" className="h-7">
            <Link href={`/${lang}/login`}>{dict.site.topBar.login}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
