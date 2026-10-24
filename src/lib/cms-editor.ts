import type { EditorLabels } from "@/components/dashboard/cms/rich-text-editor";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PageInput } from "@/lib/validation/page";

export function editorLabels(dict: Dictionary): EditorLabels {
  return dict.cms.editor;
}

export const EMPTY_PAGE: PageInput = {
  slug: "",
  title_en: "",
  title_bn: "",
  body_en: "",
  body_bn: "",
  seo_title_en: "",
  seo_title_bn: "",
  seo_description_en: "",
  seo_description_bn: "",
  is_published: false,
};
