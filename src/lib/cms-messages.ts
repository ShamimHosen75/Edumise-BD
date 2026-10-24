import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";

/** Strings the page editor and menu builder need on the client. */
export function cmsMessages(dict: Dictionary) {
  const cmsKeys = Object.keys(dict.cms)
    .filter((k) => k !== "editor")
    .map((k) => `cms.${k}` as TranslationKey);
  return pickMessages(dict, [
    ...cmsKeys,
    "auth.unexpected",
    ...errorKeys(dict),
  ]);
}
