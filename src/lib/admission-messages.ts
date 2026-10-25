import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the admission pages need in the browser. */
export function admissionMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.admission, "admission"),
    ...leafKeys(dict.admissionsAdmin, "admissionsAdmin"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    "contact.failed",
    "staff.oneTimeHint",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
