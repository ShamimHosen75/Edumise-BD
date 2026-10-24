import Link from "next/link";

import { DesktopNav } from "@/components/site/desktop-nav";
import { MobileNav } from "@/components/site/mobile-nav";
import { SchoolMark } from "@/components/site/school-mark";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { pickLocalized } from "@/lib/format";
import type { SchoolSettings } from "@/lib/settings";
import type { MenuEntry } from "@/lib/site/menu";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = {
  lang: Locale;
  dict: Dictionary;
  settings: SchoolSettings | null;
  name: string;
  menu: MenuEntry[];
};

export function SiteHeader({ lang, dict, settings, name, menu }: Props) {
  const address = settings ? pickLocalized(settings, "address", lang) : "";
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href={`/${lang}`}
          className="flex min-w-0 items-center gap-3"
          aria-label={`${name} – ${dict.site.nav.home}`}
        >
          <SchoolMark
            logoUrl={publicMediaUrl(settings?.logo_path)}
            initials={settings?.short_name || name}
            alt={t(dict, "common.logoAlt", { school: name })}
          />
          <span className="min-w-0">
            <span className="text-primary block truncate text-base font-bold sm:text-lg">
              {name}
            </span>
            {address ? (
              <span className="text-muted-foreground hidden truncate text-xs sm:block">
                {address}
              </span>
            ) : null}
          </span>
        </Link>
        <MobileNav entries={menu} labels={dict.site.nav} />
      </div>
      {menu.length > 0 ? (
        <div className="mx-auto hidden max-w-6xl px-4 pb-2 lg:block">
          <DesktopNav entries={menu} label={dict.site.nav.main} />
        </div>
      ) : null}
    </header>
  );
}
