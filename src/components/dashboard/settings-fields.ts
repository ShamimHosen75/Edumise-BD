import type { SchoolSettingsField } from "@/lib/validation/school-settings";

export type FieldKind =
  "text" | "textarea" | "email" | "url" | "tel" | "color" | "number";
export type FieldSpec = {
  name: SchoolSettingsField;
  kind: FieldKind;
  lang?: "en" | "bn";
};
export type FieldGroup = {
  key: "identity" | "contact" | "branding" | "facts" | "head";
  fields: FieldSpec[];
};

/** Layout of the school settings form. */
export const SETTINGS_GROUPS: FieldGroup[] = [
  {
    key: "identity",
    fields: [
      { name: "name_en", kind: "text", lang: "en" },
      { name: "name_bn", kind: "text", lang: "bn" },
      { name: "short_name", kind: "text" },
      { name: "address_en", kind: "textarea", lang: "en" },
      { name: "address_bn", kind: "textarea", lang: "bn" },
    ],
  },
  {
    key: "contact",
    fields: [
      { name: "phone", kind: "tel" },
      { name: "email", kind: "email" },
      { name: "website_url", kind: "url" },
      { name: "facebook_url", kind: "url" },
      { name: "youtube_url", kind: "url" },
      { name: "map_embed_url", kind: "url" },
      { name: "office_hours_en", kind: "text", lang: "en" },
      { name: "office_hours_bn", kind: "text", lang: "bn" },
    ],
  },
  {
    key: "branding",
    fields: [
      { name: "primary_color", kind: "color" },
      { name: "secondary_color", kind: "color" },
    ],
  },
  {
    key: "facts",
    fields: [
      { name: "eiin", kind: "text" },
      { name: "institution_code", kind: "text" },
      { name: "center_code", kind: "text" },
      { name: "established_year", kind: "number" },
    ],
  },
  {
    key: "head",
    fields: [
      { name: "head_name_en", kind: "text", lang: "en" },
      { name: "head_name_bn", kind: "text", lang: "bn" },
      { name: "head_message_en", kind: "textarea", lang: "en" },
      { name: "head_message_bn", kind: "textarea", lang: "bn" },
    ],
  },
];
