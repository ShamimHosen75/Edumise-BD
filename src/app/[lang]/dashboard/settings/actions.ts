"use server";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { detectImageType, imageExtension } from "@/lib/files";
import { SETTINGS_TAG } from "@/lib/settings";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  LOGO_MAX_BYTES,
  schoolSettingsSchema,
  type SchoolSettingsField,
} from "@/lib/validation/school-settings";

export type SettingsResult =
  | { ok: true }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Partial<Record<SchoolSettingsField | "logo", string>>;
    };

const FIELDS = Object.keys(schoolSettingsSchema.shape) as SchoolSettingsField[];

export async function updateSchoolSettings(
  lang: string,
  formData: FormData,
): Promise<SettingsResult> {
  if (!isLocale(lang)) return { ok: false, error: "auth.unexpected" };
  await requireRole(lang, ["super_admin", "admin"]);

  const raw = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  );
  const parsed = schoolSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SchoolSettingsField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SchoolSettingsField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: "settings.failed", fieldErrors };
  }

  const supabase = await createClient();
  const update: TablesUpdate<"school_settings"> = { ...parsed.data };

  // Optional new logo: checked by size and by its real content, then stored publicly.
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > LOGO_MAX_BYTES)
      return {
        ok: false,
        error: "settings.failed",
        fieldErrors: { logo: "errors.logoSize" },
      };
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type)
      return {
        ok: false,
        error: "settings.failed",
        fieldErrors: { logo: "errors.logoType" },
      };

    const path = `branding/logo-${Date.now()}.${imageExtension(type)}`;
    const { error } = await supabase.storage
      .from("public-media")
      .upload(path, bytes, { contentType: type });
    if (error)
      return {
        ok: false,
        error: "settings.failed",
        fieldErrors: { logo: "errors.uploadFailed" },
      };
    update.logo_path = path;
  }

  // RLS also limits this update to admins.
  const { error } = await supabase
    .from("school_settings")
    .update(update)
    .eq("id", 1);
  if (error) return { ok: false, error: "auth.unexpected" };

  // Every page that read the settings is rebuilt on its next visit.
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}
