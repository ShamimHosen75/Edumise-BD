import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SETTINGS_GROUPS } from "@/components/dashboard/settings-fields";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { errorKeys, pickMessages } from "@/i18n/messages";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).settings.title };
}

export default async function SettingsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("school_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (!s) notFound();

  const fieldKeys = SETTINGS_GROUPS.flatMap((g) => [
    `settings.groups.${g.key}` as TranslationKey,
    ...g.fields.map((f) => `settings.fields.${f.name}` as TranslationKey),
  ]);
  const messages = pickMessages(dict, [
    ...fieldKeys,
    "settings.save",
    "settings.saving",
    "settings.saved",
    "settings.failed",
    "settings.logo",
    "settings.logoHint",
    "settings.currentLogo",
    "auth.unexpected",
    ...errorKeys(dict),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{dict.settings.title}</h1>
        <p className="text-muted-foreground text-sm">{dict.settings.intro}</p>
      </div>
      <SettingsForm
        lang={lang}
        logoUrl={publicMediaUrl(s.logo_path)}
        messages={messages}
        defaults={{
          name_en: s.name_en,
          name_bn: s.name_bn,
          short_name: s.short_name,
          address_en: s.address_en,
          address_bn: s.address_bn,
          phone: s.phone,
          email: s.email,
          website_url: s.website_url,
          facebook_url: s.facebook_url,
          youtube_url: s.youtube_url,
          map_embed_url: s.map_embed_url,
          office_hours_en: s.office_hours_en,
          office_hours_bn: s.office_hours_bn,
          primary_color: s.primary_color,
          secondary_color: s.secondary_color,
          eiin: s.eiin,
          institution_code: s.institution_code,
          center_code: s.center_code,
          established_year: s.established_year ?? "",
          head_name_en: s.head_name_en,
          head_name_bn: s.head_name_bn,
          head_message_en: s.head_message_en,
          head_message_bn: s.head_message_bn,
        }}
      />
    </div>
  );
}
