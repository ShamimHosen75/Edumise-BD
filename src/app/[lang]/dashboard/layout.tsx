import { LogOut } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { signOut } from "@/app/[lang]/(auth)/actions";
import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/dashboard-nav";
import { LanguageSwitch } from "@/components/site/language-switch";
import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { requireUser } from "@/lib/auth/session";
import { navForRole } from "@/lib/nav";
import { getBranding } from "@/lib/school";

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

// Every dashboard page depends on who is logged in: never prerender or cache it.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireUser(lang);
  if (user.mustChangePassword) redirect(`/${lang}/change-password`);

  const dict = await getDictionary(lang);
  const { name: school } = await getBranding(lang, dict);
  const userName =
    (lang === "bn" && user.fullNameBn) || user.fullNameEn || user.email || "";
  const items = navForRole(user.role).map((item) => ({
    key: item.key,
    href: item.href,
    icon: item.icon,
    label: t(dict, item.label),
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative flex h-14 items-center gap-3 border-b px-4">
        <DashboardMobileNav
          lang={lang}
          items={items}
          labels={{
            nav: dict.nav.mainNav,
            menu: dict.nav.menu,
            close: dict.nav.closeMenu,
          }}
        />
        <p className="text-primary min-w-0 flex-1 truncate font-semibold">
          {school}
        </p>
        <div className="hidden text-right text-xs leading-tight sm:block">
          <p className="font-medium" data-testid="user-name">
            {userName}
          </p>
          <p className="text-muted-foreground">
            {t(dict, `roles.${user.role}`)}
          </p>
        </div>
        <LanguageSwitch current={lang} label={dict.common.changeLanguage} />
        <form action={signOut.bind(null, lang)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            aria-label={dict.auth.logout}
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{dict.auth.logout}</span>
          </Button>
        </form>
      </header>
      <div className="flex flex-1">
        <DashboardSidebar lang={lang} items={items} label={dict.nav.mainNav} />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
