import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the exam and marks pages need in the browser. */
export function examsMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.exams, "exams"),
    ...leafKeys(dict.marks, "marks"),
    ...leafKeys(dict.results, "results"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    "academic.add",
    "academic.editNamed",
    "academic.deleteNamed",
    "academic.deleteConfirm",
    "academic.saved",
    "academic.deleted",
    "contentAdmin.edit",
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
