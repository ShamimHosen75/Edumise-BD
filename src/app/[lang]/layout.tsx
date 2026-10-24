import type { Metadata } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { schoolName } from "@/lib/school";
import { getSchoolSettings } from "@/lib/settings";
import { buildThemeCss } from "@/lib/theme";

import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

// Not dynamicParams = false: with it, revalidating a page left it without a fallback (404).
// Unknown languages are rejected by isLocale() below instead.

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [dict, settings] = await Promise.all([
    getDictionary(lang),
    getSchoolSettings(),
  ]);
  const name = schoolName(settings, lang, dict);
  return {
    title: { default: name, template: `%s | ${name}` },
    description: dict.meta.description,
    alternates: { languages: { en: "/en", bn: "/bn" } },
  };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const settings = await getSchoolSettings();
  const themeCss = buildThemeCss({
    primary: settings?.primary_color,
    secondary: settings?.secondary_color,
  });

  return (
    <html lang={lang} className={`${inter.variable} ${hind.variable}`}>
      <head>
        {/* Only validated #RRGGBB values reach this string (see buildThemeCss). */}
        <style
          id="school-theme"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
