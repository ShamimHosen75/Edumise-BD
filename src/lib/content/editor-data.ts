import "server-only";

import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { editorLabels } from "@/lib/cms-editor";
import { pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { contentAdminMessages } from "./admin-messages";
import {
  canPublish,
  isContentModule,
  MODULE_ROLES,
  type ContentModule,
} from "./modules";

/** Everything the new / edit pages share: access check, strings and select options. */
export async function loadEditor(lang: string, module: string) {
  if (!isLocale(lang) || !isContentModule(module)) notFound();
  const user = await requireRole(lang, MODULE_ROLES[module]);
  const dict = await getDictionary(lang);
  const supabase = await createClient();
  const [classes, albums] = await Promise.all([
    module === "notices"
      ? supabase.from("classes").select("id, name_en, name_bn").order("level")
      : null,
    module === "events"
      ? supabase
          .from("gallery_albums")
          .select("id, title_en, title_bn")
          .order("event_date", { ascending: false, nullsFirst: false })
      : null,
  ]);
  return {
    lang: lang as Locale,
    module: module as ContentModule,
    user,
    dict,
    supabase,
    formProps: {
      canPublish: canPublish(user.role),
      classes: (classes?.data ?? []).map((c) => ({
        value: c.id,
        label: pickLocalized(c, "name", lang),
      })),
      albums: (albums?.data ?? []).map((a) => ({
        value: a.id,
        label: pickLocalized(a, "title", lang),
      })),
      messages: contentAdminMessages(dict),
      editorLabels: editorLabels(dict),
    },
  };
}
