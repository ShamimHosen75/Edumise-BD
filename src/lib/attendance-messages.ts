import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the attendance pages need in the browser. */
export function attendanceMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.attendance, "attendance"),
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
