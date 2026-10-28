"use server";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { readUpload } from "@/lib/uploads";
import { xlsxRecords } from "@/lib/xlsx-read";

/**
 * Reads an uploaded Excel (.xlsx) file into rows keyed by the header row, for the
 * import previews (CSV files are read in the browser). Staff only; nothing is saved.
 */
export async function readSpreadsheet(
  lang: string,
  formData: FormData,
): Promise<
  | { ok: true; rows: Record<string, string>[] }
  | { ok: false; error: TranslationKey }
> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin", "teacher"]);
  const read = await readUpload(formData, 2 * 1024 * 1024);
  if ("error" in read) return { ok: false, error: read.error };
  try {
    return { ok: true, rows: xlsxRecords(read.bytes) };
  } catch {
    return { ok: false, error: "errors.spreadsheet" };
  }
}
