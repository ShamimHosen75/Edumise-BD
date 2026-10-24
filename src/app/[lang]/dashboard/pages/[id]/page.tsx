import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/dashboard/cms/page-editor";
import { PageMedia } from "@/components/dashboard/cms/page-media";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { editorLabels } from "@/lib/cms-editor";
import { cmsMessages } from "@/lib/cms-messages";
import { formatBytes, pickLocalized } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/supabase/public";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).cms.editTitle }
    : {};
}

export default async function EditPage({ params }: Props) {
  const { lang, id: rawId } = await params;
  const id = Number(rawId);
  if (!isLocale(lang) || !Number.isSafeInteger(id) || id <= 0) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const [{ data: page }, { data: files }] = await Promise.all([
    supabase.from("pages").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("page_attachments")
      .select("*")
      .eq("page_id", id)
      .order("sort_order")
      .order("id"),
  ]);
  if (!page) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {dict.cms.editTitle}: {pickLocalized(page, "title", lang)}
      </h1>
      <PageEditor
        lang={lang}
        id={id}
        messages={cmsMessages(dict)}
        editorLabels={editorLabels(dict)}
        defaults={{
          slug: page.slug,
          title_en: page.title_en,
          title_bn: page.title_bn,
          body_en: page.body_en,
          body_bn: page.body_bn,
          seo_title_en: page.seo_title_en,
          seo_title_bn: page.seo_title_bn,
          seo_description_en: page.seo_description_en,
          seo_description_bn: page.seo_description_bn,
          is_published: page.is_published,
        }}
      />
      <PageMedia
        lang={lang}
        pageId={id}
        messages={cmsMessages(dict)}
        coverUrl={publicMediaUrl(page.cover_path)}
        attachments={(files ?? []).map((f) => ({
          id: f.id,
          label: pickLocalized(f, "label", lang),
          url: publicMediaUrl(f.file_path) ?? "#",
          size: formatBytes(f.file_size, lang),
        }))}
      />
    </div>
  );
}
