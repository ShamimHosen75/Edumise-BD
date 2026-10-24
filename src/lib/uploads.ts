import "server-only";

import type { TranslationKey } from "@/i18n/t";

/** Reads one uploaded file from a form, rejecting a missing, empty or too large file. */
export async function readUpload(
  formData: FormData,
  max: number,
  field = "file",
): Promise<{ error: TranslationKey } | { file: File; bytes: Uint8Array }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0)
    return { error: "errors.required" };
  if (file.size > max) return { error: "errors.fileSize" };
  return { file, bytes: new Uint8Array(await file.arrayBuffer()) };
}
