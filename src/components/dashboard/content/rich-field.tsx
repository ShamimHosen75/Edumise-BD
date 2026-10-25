"use client";

import { Controller } from "react-hook-form";

import {
  RichTextEditor,
  type EditorLabels,
} from "@/components/dashboard/cms/rich-text-editor";
import { FormField } from "@/components/ui/form-field";

import { errorOf, type Base } from "./form-controls";

/** Rich text body field (kept apart so forms without one do not load the editor). */
export function RichField({
  form,
  name,
  label,
  t,
  lang,
  labels,
  onUploadImage,
}: Base & {
  lang: "en" | "bn";
  labels: EditorLabels;
  onUploadImage?: (file: File) => Promise<string | null>;
}) {
  return (
    <FormField id={name} label={label} error={t(errorOf(form, name))}>
      {(aria) => (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <RichTextEditor
              id={aria.id}
              lang={lang}
              value={String(field.value ?? "")}
              onChange={field.onChange}
              labels={labels}
              invalid={aria["aria-invalid"]}
              describedBy={aria["aria-describedby"]}
              onUploadImage={onUploadImage}
            />
          )}
        />
      )}
    </FormField>
  );
}
