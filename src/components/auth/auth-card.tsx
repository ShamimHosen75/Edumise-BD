import { LanguageSwitch } from "@/components/site/language-switch";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  school: string;
  changeLanguage: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
};

export function AuthCard({
  lang,
  school,
  changeLanguage,
  title,
  intro,
  children,
}: Props) {
  return (
    <main className="bg-muted/40 flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-primary min-w-0 truncate font-semibold">
            {school}
          </p>
          <LanguageSwitch current={lang} label={changeLanguage} />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {intro ? (
          <p className="text-muted-foreground mt-1 mb-4 text-sm">{intro}</p>
        ) : (
          <div className="mb-4" />
        )}
        {children}
      </div>
    </main>
  );
}
