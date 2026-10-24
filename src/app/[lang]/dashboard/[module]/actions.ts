"use server";

import { randomUUID } from "node:crypto";

import type { TranslationKey } from "@/i18n/t";
import {
  canPublish,
  MODULE_FILE,
  type ContentModule,
} from "@/lib/content/modules";
import { authorize, refreshModule, removeFiles } from "@/lib/content/server";
import { toContentRow } from "@/lib/content/rows";
import {
  ATTACHMENT_MAX_BYTES,
  detectDocumentType,
  detectImageType,
  IMAGE_MAX_BYTES,
  imageExtension,
} from "@/lib/files";
import { readUpload } from "@/lib/uploads";
import { CONTENT_SCHEMAS } from "@/lib/validation/content";

export type FieldErrors = Record<string, TranslationKey>;
export type SaveResult =
  | { ok: true; id: number }
  | { ok: false; error: TranslationKey; fieldErrors?: FieldErrors };
export type SimpleResult = { ok: true } | { ok: false; error: TranslationKey };

const HAS_AUTHOR: readonly ContentModule[] = ["notices", "news", "events"];

/** Creates (id = null) or updates an item. Teachers can only save drafts. */
export async function saveContent(
  lang: string,
  moduleName: string,
  id: number | null,
  input: unknown,
): Promise<SaveResult> {
  const { module, user, db, table } = await authorize(lang, moduleName);
  const parsed = CONTENT_SCHEMAS[module].safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] ??= issue.message as TranslationKey;
    return { ok: false, error: "contentAdmin.failed", fieldErrors };
  }

  let existing: { published_at: string | null; is_published: boolean } | null =
    null;
  if (id !== null) {
    const { data } = await db
      .from(table)
      .select("published_at, is_published")
      .eq("id", id)
      .maybeSingle();
    if (!data) return { ok: false, error: "errors.notAllowed" };
    existing = data;
  }
  const publisher = canPublish(user.role);
  if (!publisher && existing?.is_published)
    return { ok: false, error: "errors.notAllowed" };

  const row = toContentRow(module, parsed.data, {
    canPublish: publisher,
    existingPublishedAt: existing?.published_at ?? null,
    mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (id === null && HAS_AUTHOR.includes(module)) row.created_by = user.id;

  const { data, error } =
    id === null
      ? await db.from(table).insert(row).select("id").single()
      : await db.from(table).update(row).eq("id", id).select("id").single();
  if (error?.code === "23505")
    return {
      ok: false,
      error: "contentAdmin.failed",
      fieldErrors: { slug: "errors.slugTaken" },
    };
  // downloads_published_has_file: a download is published only with its file.
  if (error?.code === "23514" && module === "downloads")
    return {
      ok: false,
      error: "errors.fileRequired",
      fieldErrors: { is_published: "errors.fileRequired" },
    };
  if (error || !data) return { ok: false, error: "auth.unexpected" };
  refreshModule(module);
  return { ok: true, id: data.id as number };
}

export async function deleteContent(
  lang: string,
  moduleName: string,
  id: number,
): Promise<SimpleResult> {
  const { module, db, table } = await authorize(lang, moduleName);
  const fileColumn = MODULE_FILE[module].column;
  const photos =
    module === "gallery"
      ? ((
          await db
            .from("gallery_images")
            .select("image_path")
            .eq("album_id", id)
        ).data ?? [])
      : [];
  const { data, error } = await db
    .from(table)
    .delete()
    .eq("id", id)
    .select(fileColumn);
  if (error) return { ok: false, error: "auth.unexpected" };
  // RLS hides rows the user may not delete, so nothing is returned for them.
  if (!data || data.length === 0)
    return { ok: false, error: "errors.notAllowed" };
  await removeFiles(db, [
    ...data.map((r) => (r as Record<string, unknown>)[fileColumn]),
    ...photos.map((p) => p.image_path),
  ]);
  refreshModule(module);
  return { ok: true };
}

/** Uploads the item's file (attachment, cover or download), checked by its real content. */
export async function uploadContentFile(
  lang: string,
  moduleName: string,
  id: number,
  formData: FormData,
): Promise<SimpleResult> {
  const { module, user, db, table } = await authorize(lang, moduleName);
  const { column, kind } = MODULE_FILE[module];
  const read = await readUpload(
    formData,
    kind === "image" ? IMAGE_MAX_BYTES : ATTACHMENT_MAX_BYTES,
  );
  if ("error" in read) return { ok: false, error: read.error };
  const type =
    kind === "image"
      ? detectImageType(read.bytes)
      : detectDocumentType(read.bytes);
  if (!type)
    return {
      ok: false,
      error: kind === "image" ? "errors.imageType" : "errors.fileType",
    };

  const { data: current } = await db
    .from(table)
    .select(column)
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };

  // Teachers may only write to notices/<their id>/ (Storage policy).
  const path = `${module}/${user.id}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await db.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };

  const update: Record<string, unknown> = { [column]: path };
  if (module === "downloads") {
    update.file_size = read.bytes.byteLength;
    update.mime_type = type;
  }
  const { data, error } = await db
    .from(table)
    .update(update)
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) {
    await removeFiles(db, [path]);
    return {
      ok: false,
      error: error ? "auth.unexpected" : "errors.notAllowed",
    };
  }
  // An album cover may be one of its photos, so only other modules drop the old file.
  if (module !== "gallery")
    await removeFiles(db, [(current as Record<string, unknown>)[column]]);
  refreshModule(module);
  return { ok: true };
}

export async function removeContentFile(
  lang: string,
  moduleName: string,
  id: number,
): Promise<SimpleResult> {
  const { module, db, table } = await authorize(lang, moduleName);
  const { column } = MODULE_FILE[module];
  const { data: current } = await db
    .from(table)
    .select(column)
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const update: Record<string, unknown> = { [column]: null };
  if (module === "downloads") {
    update.file_size = null;
    update.mime_type = null;
  }
  const { data, error } = await db
    .from(table)
    .update(update)
    .eq("id", id)
    .select("id");
  if (error?.code === "23514")
    return { ok: false, error: "errors.fileRequired" };
  if (error || !data || data.length === 0)
    return {
      ok: false,
      error: error ? "auth.unexpected" : "errors.notAllowed",
    };
  if (module !== "gallery")
    await removeFiles(db, [(current as Record<string, unknown>)[column]]);
  refreshModule(module);
  return { ok: true };
}

export type UploadResult =
  { ok: true; url: string } | { ok: false; error: TranslationKey };

/** Image inserted into the body text of a saved item. */
export async function uploadBodyImage(
  lang: string,
  moduleName: string,
  id: number,
  formData: FormData,
): Promise<UploadResult> {
  const { module, user, db, table } = await authorize(lang, moduleName);
  const { data: item } = await db
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!item) return { ok: false, error: "errors.notAllowed" };
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.imageType" };
  const path = `${module}/${user.id}/${randomUUID()}.${imageExtension(type)}`;
  const { error } = await db.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (error) return { ok: false, error: "errors.uploadFailed" };
  return {
    ok: true,
    url: db.storage.from("public-media").getPublicUrl(path).data.publicUrl,
  };
}
