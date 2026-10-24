"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";

import type { ContentModule } from "@/lib/content/modules";
import {
  DOWNLOAD_CATEGORIES,
  NOTICE_AUDIENCES,
  NOTICE_CATEGORIES,
} from "@/lib/validation/content";

import { CheckboxField, SelectField, TextField } from "./form-controls";

export type Option = { value: number; label: string };

/** Fields that only some modules have (category, audience, dates, album). */
export function ModuleFields({
  module,
  form,
  m,
  classes,
  albums,
}: {
  module: ContentModule;
  form: UseFormReturn<FieldValues>;
  m: (key: string | undefined) => string | undefined;
  classes: Option[];
  albums: Option[];
}) {
  const label = (key: string) => m(`contentAdmin.fields.${key}`)!;
  const base = { form, t: m };
  const audience = form.watch("audience");

  if (module === "notices")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          {...base}
          name="category"
          label={label("category")}
          options={NOTICE_CATEGORIES.map((c) => ({
            value: c,
            label: m(`content.categories.${c}`)!,
          }))}
        />
        <SelectField
          {...base}
          name="audience"
          label={label("audience")}
          options={NOTICE_AUDIENCES.map((a) => ({
            value: a,
            label: m(`contentAdmin.audiences.${a}`)!,
          }))}
        />
        {audience === "class" ? (
          <SelectField
            {...base}
            name="target_class_id"
            label={label("targetClass")}
            numeric
            empty={label("chooseClass")}
            options={classes}
          />
        ) : null}
        <div className="sm:pt-6">
          <CheckboxField form={form} name="is_pinned" label={label("pinned")} />
        </div>
      </div>
    );

  if (module === "downloads")
    return (
      <SelectField
        {...base}
        name="category"
        label={label("category")}
        options={DOWNLOAD_CATEGORIES.map((c) => ({
          value: c,
          label: m(`content.downloadCategories.${c}`)!,
        }))}
      />
    );

  if (module === "events")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          {...base}
          type="datetime-local"
          name="starts_at"
          label={label("startsAt")}
          hint={m("contentAdmin.fields.bdTime")}
        />
        <TextField
          {...base}
          type="datetime-local"
          name="ends_at"
          label={label("endsAt")}
        />
        <SelectField
          {...base}
          name="album_id"
          label={label("album")}
          numeric
          empty={label("noAlbum")}
          options={albums}
        />
      </div>
    );

  if (module === "gallery")
    return (
      <TextField
        {...base}
        type="date"
        name="event_date"
        label={label("eventDate")}
      />
    );

  return null;
}
