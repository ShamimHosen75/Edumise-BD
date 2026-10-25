import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the staff pages need in the browser. */
export function staffMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.staff, "staff"),
    ...leafKeys(dict.academic, "academic"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    ...leafKeys(dict.contentAdmin, "contentAdmin"),
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
