import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/dashboard/cms/page-editor";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireRole } from "@/lib/auth/session";
import { EMPTY_PAGE, editorLabels } from "@/lib/cms-editor";
import { cmsMessages } from "@/lib/cms-messages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang)
    ? { title: (await getDictionary(lang)).cms.newTitle }
    : {};
}

export default async function NewPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireRole(lang, ["super_admin", "admin"]);
  const dict = await getDictionary(lang);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{dict.cms.newTitle}</h1>
      <PageEditor
        lang={lang}
        id={null}
        defaults={EMPTY_PAGE}
        messages={cmsMessages(dict)}
        editorLabels={editorLabels(dict)}
      />
      <p className="text-muted-foreground text-sm">{dict.cms.saveFirst}</p>
    </div>
  );
}
