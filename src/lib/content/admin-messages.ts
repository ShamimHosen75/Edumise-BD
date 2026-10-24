import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";

/** Every string key under a dictionary section, nested ones included ("a.b.c"). */
export function leafKeys(node: unknown, prefix: string): TranslationKey[] {
  if (typeof node === "string") return [prefix as TranslationKey];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([k, v]) =>
    leafKeys(v, `${prefix}.${k}`),
  );
}

/** Strings the dashboard content forms need on the client. */
export function contentAdminMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.contentAdmin, "contentAdmin"),
    ...leafKeys(dict.content.categories, "content.categories"),
    ...leafKeys(dict.content.downloadCategories, "content.downloadCategories"),
    "cms.english",
    "cms.bangla",
    "cms.languageTabs",
    "auth.unexpected",
    ...errorKeys(dict),
  ]);
}
