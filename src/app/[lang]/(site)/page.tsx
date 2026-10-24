import Image from "next/image";
import { notFound } from "next/navigation";

import { LanguageSwitch } from "@/components/site/language-switch";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import {
  formatDate,
  formatNumber,
  localizeDigits,
  pickLocalized,
} from "@/lib/format";
import { getBranding } from "@/lib/school";
import { publicMediaUrl } from "@/lib/supabase/public";

type PageProps = { params: Promise<{ lang: string }> };

// Static page, refreshed hourly or when settings change (revalidateTag).
export const revalidate = 3600;

export default async function HomePage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { settings, name } = await getBranding(lang, dict);
  const logo = publicMediaUrl(settings?.logo_path);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {logo ? (
            <Image
              src={logo}
              unoptimized
              alt={t(dict, "common.logoAlt", { school: name })}
              width={56}
              height={56}
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
            >
              {(settings?.short_name || name).slice(0, 3)}
            </span>
          )}
          <p className="text-primary truncate font-semibold">{name}</p>
        </div>
        <LanguageSwitch current={lang} label={dict.common.changeLanguage} />
      </div>

      <h1 className="text-2xl font-semibold sm:text-3xl">
        {t(dict, "home.heading", { school: name })}
      </h1>
      <p className="text-muted-foreground">{dict.home.intro}</p>

      <ul className="flex flex-col gap-1 text-sm">
        {settings?.established_year ? (
          <li data-testid="established">
            {t(dict, "home.established", {
              year: formatNumber(settings.established_year, lang, {
                grouping: false,
              }),
            })}
          </li>
        ) : null}
        {settings?.eiin ? (
          <li>
            {t(dict, "home.eiin", {
              eiin: localizeDigits(settings.eiin, lang),
            })}
          </li>
        ) : null}
        <li data-testid="today">
          {t(dict, "home.today", { date: formatDate(new Date(), lang) })}
        </li>
      </ul>

      {settings ? (
        <address className="text-muted-foreground text-sm not-italic">
          {pickLocalized(settings, "address", lang)}
        </address>
      ) : null}
    </main>
  );
}
