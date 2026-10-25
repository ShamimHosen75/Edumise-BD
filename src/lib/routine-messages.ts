import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the routine and exam schedule pages need in the browser. */
export function routineMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.routine, "routine"),
    ...leafKeys(dict.days, "days"),
    ...leafKeys(dict.examSchedule, "examSchedule"),
    ...leafKeys(dict.academic, "academic"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    "contentAdmin.edit",
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
