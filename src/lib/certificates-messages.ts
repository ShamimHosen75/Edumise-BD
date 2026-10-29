import type { Dictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { leafKeys } from "@/lib/content/admin-messages";

/** Strings the certificate pages need in the browser. */
export function certificatesMessages(dict: Dictionary) {
  return pickMessages(dict, [
    ...leafKeys(
      { ...dict.certificates, templates: undefined } as Record<string, unknown>,
      "certificates",
    ),
    ...leafKeys(dict.dialog, "dialog"),
    "contentAdmin.failed",
    "auth.unexpected",
    ...errorKeys(dict),
  ] as TranslationKey[]);
}
