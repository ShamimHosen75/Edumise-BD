import "server-only";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { pickLocalized } from "@/lib/format";
import { getSchoolSettings, type SchoolSettings } from "@/lib/settings";

/** School name in the reader's language, or the generic dictionary title if settings are missing. */
export function schoolName(
  settings: SchoolSettings | null,
  lang: Locale,
  dict: Dictionary,
): string {
  return settings ? pickLocalized(settings, "name", lang) : dict.meta.title;
}

export async function getBranding(lang: Locale, dict: Dictionary) {
  const settings = await getSchoolSettings();
  return { settings, name: schoolName(settings, lang, dict) };
}
