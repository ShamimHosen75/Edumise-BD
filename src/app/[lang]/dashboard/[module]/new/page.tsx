import type { Metadata } from "next";

import { ContentForm } from "@/components/dashboard/content/content-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { t } from "@/i18n/t";
import { loadEditor } from "@/lib/content/editor-data";
import { isContentModule } from "@/lib/content/modules";
import { toFormValues } from "@/lib/content/rows";

type Props = { params: Promise<{ lang: string; module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, module } = await params;
  if (!isLocale(lang) || !isContentModule(module)) return {};
  const dict = await getDictionary(lang);
  return {
    title: t(dict, "contentAdmin.newItem", { section: dict.content[module] }),
  };
}

export default async function NewContent({ params }: Props) {
  const p = await params;
  const { lang, module, dict, formProps } = await loadEditor(p.lang, p.module);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t(dict, "contentAdmin.newItem", { section: dict.content[module] })}
      </h1>
      <ContentForm
        lang={lang}
        module={module}
        id={null}
        defaults={toFormValues(module, null)}
        {...formProps}
      />
      <p className="text-muted-foreground text-sm">
        {dict.contentAdmin.saveFirst}
      </p>
    </div>
  );
}
