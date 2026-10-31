"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import {
  ATTACHMENT_MAX_BYTES,
  detectDocumentType,
  detectImageType,
  IMAGE_MAX_BYTES,
  imageExtension,
} from "@/lib/files";
import { sanitizeRichText } from "@/lib/sanitize";
import { TAGS } from "@/lib/site/cache";
import { removeFiles } from "@/lib/storage-files";
import { readUpload } from "@/lib/uploads";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import { createClient } from "@/lib/supabase/server";
import { pageSchema, type PageInput } from "@/lib/validation/page";

type FieldErrors = Partial<Record<keyof PageInput, string>>;
export type SaveResult =
  | { ok: true; id: number }
  | { ok: false; error: TranslationKey; fieldErrors?: FieldErrors };
export type UploadResult =
  { ok: true; url: string } | { ok: false; error: TranslationKey };
export type SimpleResult = { ok: true } | { ok: false; error: TranslationKey };

async function adminOnly(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin"]);
  return createClient();
}

function refresh() {
  revalidateTag(TAGS.pages);
  revalidateTag(TAGS.menu);
}

const mediaBaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Creates (id = null) or updates a page. Body HTML is sanitised before it is stored. */
export async function savePage(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<SaveResult> {
  assertOptionalId(id);
  const supabase = await adminOnly(lang);
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path[0] as keyof PageInput] ??= issue.message;
    return { ok: false, error: "cms.failed", fieldErrors };
  }
  const v = parsed.data;
  // Keep the first publish date when a page is saved again (or unpublished and
  // published later).
  let existing: string | null = null;
  if (id !== null) {
    const { data: current } = await supabase
      .from("pages")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    existing = current?.published_at ?? null;
  }
  const row = {
    ...v,
    body_en: sanitizeRichText(v.body_en, { mediaBaseUrl: mediaBaseUrl() }),
    body_bn: sanitizeRichText(v.body_bn, { mediaBaseUrl: mediaBaseUrl() }),
    published_at: v.is_published
      ? (existing ?? new Date().toISOString())
      : existing,
  };

  const query =
    id === null
      ? supabase.from("pages").insert(row).select("id").single()
      : supabase.from("pages").update(row).eq("id", id).select("id").single();
  const { data, error } = await query;
  if (error?.code === "23505")
    return {
      ok: false,
      error: "cms.failed",
      fieldErrors: { slug: "errors.slugTaken" },
    };
  if (error || !data) return { ok: false, error: "auth.unexpected" };
  refresh();
  return { ok: true, id: data.id };
}

export async function deletePage(
  lang: string,
  id: number,
): Promise<SimpleResult> {
  assertId(id);
  const supabase = await adminOnly(lang);
  const { data, error } = await supabase
    .from("pages")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "auth.unexpected" };
  if (!data?.length) return { ok: false, error: "errors.notAllowed" };
  // The cover, body images and attachments live in this page's own folders.
  const store = supabase.storage.from("public-media");
  const listed = await Promise.all(
    [`pages/${id}`, `attachments/${id}`].map(async (folder) =>
      ((await store.list(folder, { limit: 1000 })).data ?? []).map(
        (f) => `${folder}/${f.name}`,
      ),
    ),
  );
  await removeFiles(supabase, listed.flat(), [
    `pages/${id}/`,
    `attachments/${id}/`,
  ]);
  refresh();
  return { ok: true };
}

/** Image for the editor (inserted into the page body). Checked by its real content. */
export async function uploadPageImage(
  lang: string,
  pageId: number,
  formData: FormData,
): Promise<UploadResult> {
  assertId(pageId);
  const supabase = await adminOnly(lang);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.imageType" };
  const path = `pages/${pageId}/${randomUUID()}.${imageExtension(type)}`;
  const { error } = await supabase.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (error) return { ok: false, error: "errors.uploadFailed" };
  return {
    ok: true,
    url: supabase.storage.from("public-media").getPublicUrl(path).data
      .publicUrl,
  };
}

export async function setPageCover(
  lang: string,
  pageId: number,
  formData: FormData,
): Promise<SimpleResult> {
  assertId(pageId);
  const supabase = await adminOnly(lang);
  const { data: page } = await supabase
    .from("pages")
    .select("cover_path")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return { ok: false, error: "errors.notAllowed" };
  let coverPath: string | null = null;
  if (formData.get("remove") !== "1") {
    const read = await readUpload(formData, IMAGE_MAX_BYTES);
    if ("error" in read) return { ok: false, error: read.error };
    const type = detectImageType(read.bytes);
    if (!type) return { ok: false, error: "errors.imageType" };
    coverPath = `pages/${pageId}/cover-${randomUUID()}.${imageExtension(type)}`;
    const { error } = await supabase.storage
      .from("public-media")
      .upload(coverPath, read.bytes, { contentType: type });
    if (error) return { ok: false, error: "errors.uploadFailed" };
  }
  const { error } = await supabase
    .from("pages")
    .update({ cover_path: coverPath })
    .eq("id", pageId);
  const folder = [`pages/${pageId}/`];
  if (error) {
    await removeFiles(supabase, [coverPath], folder);
    return { ok: false, error: "auth.unexpected" };
  }
  await removeFiles(supabase, [page.cover_path], folder);
  refresh();
  return { ok: true };
}

const attachmentLabelSchema = z.object({
  label: z.string().trim().min(1).max(120),
  label_bn: z.string().trim().max(120),
});

export async function addAttachment(
  lang: string,
  pageId: number,
  formData: FormData,
): Promise<SimpleResult> {
  assertId(pageId);
  const supabase = await adminOnly(lang);
  // A6 (Step 6.2): labels checked with Zod, before the file is read.
  const labels = attachmentLabelSchema.safeParse({
    label: formData.get("label") ?? "",
    label_bn: formData.get("label_bn") ?? "",
  });
  if (!labels.success) return { ok: false, error: "errors.required" };
  const label = labels.data.label;
  const read = await readUpload(formData, ATTACHMENT_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectDocumentType(read.bytes);
  if (!type) return { ok: false, error: "errors.fileType" };

  const path = `attachments/${pageId}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await supabase.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await supabase.from("page_attachments").insert({
    page_id: pageId,
    label_en: label,
    label_bn: labels.data.label_bn,
    file_path: path,
    mime_type: type,
    file_size: read.bytes.byteLength,
  });
  if (error) {
    await removeFiles(supabase, [path], [`attachments/${pageId}/`]);
    return { ok: false, error: "auth.unexpected" };
  }
  refresh();
  return { ok: true };
}

export async function removeAttachment(
  lang: string,
  attachmentId: number,
): Promise<SimpleResult> {
  assertId(attachmentId);
  const supabase = await adminOnly(lang);
  const { data, error } = await supabase
    .from("page_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("file_path")
    .single();
  if (error || !data) return { ok: false, error: "auth.unexpected" };
  await removeFiles(supabase, [data.file_path], ["attachments/"]);
  refresh();
  return { ok: true };
}
