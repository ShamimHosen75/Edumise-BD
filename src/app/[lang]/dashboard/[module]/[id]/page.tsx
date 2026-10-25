import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  removeContentFile,
  uploadContentFile,
} from "@/app/[lang]/dashboard/[module]/actions";
import { AlbumPhotos } from "@/components/dashboard/content/album-photos";
import { ContentFile } from "@/components/dashboard/content/content-file";
import { ContentForm } from "@/components/dashboard/content/content-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { loadEditor } from "@/lib/content/editor-data";
import {
  isContentModule,
  MODULE_FILE,
  MODULE_TABLE,
} from "@/lib/content/modules";
import { toFormValues } from "@/lib/content/rows";
import { pickLocalized } from "@/lib/format";
import { publicMediaUrl } from "@/lib/supabase/public";

const FILE_LABEL = {
  notices: "attachment",
  news: "cover",
  events: "cover",
  gallery: "cover",
  downloads: "downloadFile",
} as const;

type Props = { params: Promise<{ lang: string; module: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, module } = await params;
  if (!isLocale(lang) || !isContentModule(module)) return {};
  return { title: (await getDictionary(lang)).contentAdmin.edit };
}

export default async function EditContent({ params }: Props) {
  const p = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(p.id) ? Number(p.id) : null;
  const { lang, module, dict, supabase, formProps } = await loadEditor(
    p.lang,
    p.module,
  );
  if (id === null) notFound();
  const db = supabase as unknown as SupabaseClient;
  const { data: row } = await db
    .from(MODULE_TABLE[module])
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  // Teachers may open only their own drafts (RLS also hides other teachers' drafts).
  if (!formProps.canPublish && row.is_published) notFound();

  const photos =
    module === "gallery"
      ? ((
          await supabase
            .from("gallery_images")
            .select("id, image_path, caption_en, caption_bn")
            .eq("album_id", id)
            .order("sort_order")
            .order("id")
        ).data ?? [])
      : [];
  const file = row[MODULE_FILE[module].column] as string | null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t(dict, "contentAdmin.editItem", {
          title: pickLocalized(row, "title", lang),
        })}
      </h1>
      <ContentForm
        lang={lang}
        module={module}
        id={id}
        defaults={toFormValues(module, row)}
        {...formProps}
      />
      <ContentFile
        title={dict.contentAdmin[FILE_LABEL[module]]}
        kind={MODULE_FILE[module].kind}
        url={publicMediaUrl(file)}
        messages={formProps.messages}
        upload={uploadContentFile.bind(null, lang, module, id)}
        remove={removeContentFile.bind(null, lang, module, id)}
      />
      {module === "gallery" ? (
        <AlbumPhotos
          lang={lang}
          albumId={id}
          messages={formProps.messages}
          photos={photos.flatMap((ph) => {
            const url = publicMediaUrl(ph.image_path);
            return url
              ? [
                  {
                    id: ph.id,
                    url,
                    caption_en: ph.caption_en,
                    caption_bn: ph.caption_bn,
                    isCover: ph.image_path === file,
                  },
                ]
              : [];
          })}
        />
      ) : null}
    </div>
  );
}
