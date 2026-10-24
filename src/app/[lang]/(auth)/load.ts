import "server-only";

import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getBranding } from "@/lib/school";

/** Shared loader for the auth pages. */
export async function loadAuthPage(params: Promise<{ lang: string }>): Promise<{
  lang: Locale;
  dict: Dictionary;
  school: string;
}> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { name } = await getBranding(lang, dict);
  return { lang, dict, school: name };
}
