import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the students pages need in the browser. */
export function studentMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(dict.students, "students"),
    ...leafKeys(dict.studentProfile, "studentProfile"),
    ...leafKeys(dict.promotion, "promotion"),
    ...leafKeys(dict.importStudents, "importStudents"),
    ...leafKeys(dict.admission.genders, "admission.genders"),
    ...leafKeys(dict.admission.religions, "admission.religions"),
    ...leafKeys(dict.table, "table"),
    ...leafKeys(dict.dialog, "dialog"),
    ...leafKeys(dict.contentAdmin, "contentAdmin"),
    "admission.fields.birthCertificate",
    "admission.fields.transcript",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
