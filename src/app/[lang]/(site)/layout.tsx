import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TopBar } from "@/components/site/top-bar";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getBranding } from "@/lib/school";
import { getMenuRows, getSiteLinks } from "@/lib/site/data";
import { buildMenu } from "@/lib/site/menu";

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

/** Public website shell: top bar, header with menu, footer. */
export default async function SiteLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const [{ settings, name }, menuRows, links] = await Promise.all([
    getBranding(lang, dict),
    getMenuRows(),
    getSiteLinks(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-background sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {dict.common.skipToContent}
      </a>
      <TopBar lang={lang} dict={dict} settings={settings} />
      <SiteHeader
        lang={lang}
        dict={dict}
        settings={settings}
        name={name}
        menu={buildMenu(menuRows, lang)}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter
        lang={lang}
        dict={dict}
        settings={settings}
        name={name}
        links={links.filter((l) => l.placement === "footer")}
      />
    </div>
  );
}
