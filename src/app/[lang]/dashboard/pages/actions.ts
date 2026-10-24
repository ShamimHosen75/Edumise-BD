"use server";

import { randomUUID } from "node:crypto";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import {
  detectDocumentType,
  detectImageType,
  imageExtension,
} from "@/lib/files";
import { sanitizeRichText } from "@/lib/sanitize";
import { TAGS } from "@/lib/site/cache";
import { createClient } from "@/lib/supabase/server";
import { pageSchema, type PageInput } from "@/lib/validation/page";

type FieldErrors = Partial<Record<keyof PageInput, string>>;
export type SaveResult =
  | { ok: true; id: number }
  | { ok: false; error: TranslationKey; fieldErrors?: FieldErrors };
export type UploadResult =
  { ok: true; url: string } | { ok: false; error: TranslationKey };
export type SimpleResult = { ok: true } | { ok: false; error: TranslationKey };

const IMAGE_MAX = 2 * 1024 * 1024;
const ATTACHMENT_MAX = 10 * 1024 * 1024;

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
  const supabase = await adminOnly(lang);
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues)
      fieldErrors[issue.path[0] as keyof PageInput] ??= issue.message;
    return { ok: false, error: "cms.failed", fieldErrors };
  }
  const v = parsed.data;
  const row = {
    ...v,
    body_en: sanitizeRichText(v.body_en, { mediaBaseUrl: mediaBaseUrl() }),
    body_bn: sanitizeRichText(v.body_bn, { mediaBaseUrl: mediaBaseUrl() }),
    published_at: v.is_published ? new Date().toISOString() : null,
  };

  // Keep the original publish date when a published page is edited again.
  if (id !== null && v.is_published) {
    const { data: current } = await supabase
      .from("pages")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (current?.published_at) row.published_at = current.published_at;
  }

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
  const supabase = await adminOnly(lang);
  const { error } = await supabase.from("pages").delete().eq("id", id);
  if (error) return { ok: false, error: "auth.unexpected" };
  refresh();
  return { ok: true };
}

async function readFile(
  formData: FormData,
  max: number,
): Promise<{ error: TranslationKey } | { file: File; bytes: Uint8Array }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "errors.required" };
  if (file.size > max) return { error: "errors.fileSize" };
  return { file, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Image for the editor (inserted into the page body). Checked by its real content. */
export async function uploadPageImage(
  lang: string,
  pageId: number,
  formData: FormData,
): Promise<UploadResult> {
  const supabase = await adminOnly(lang);
  const read = await readFile(formData, IMAGE_MAX);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.logoType" };
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
  const supabase = await adminOnly(lang);
  let coverPath: string | null = null;
  if (formData.get("remove") !== "1") {
    const read = await readFile(formData, IMAGE_MAX);
    if ("error" in read) return { ok: false, error: read.error };
    const type = detectImageType(read.bytes);
    if (!type) return { ok: false, error: "errors.logoType" };
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
  if (error) return { ok: false, error: "auth.unexpected" };
  refresh();
  return { ok: true };
}

export async function addAttachment(
  lang: string,
  pageId: number,
  formData: FormData,
): Promise<SimpleResult> {
  const supabase = await adminOnly(lang);
  const label = String(formData.get("label") ?? "").trim();
  if (!label || label.length > 120)
    return { ok: false, error: "errors.required" };
  const read = await readFile(formData, ATTACHMENT_MAX);
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
    label_bn: String(formData.get("label_bn") ?? "")
      .trim()
      .slice(0, 120),
    file_path: path,
    mime_type: type,
    file_size: read.bytes.byteLength,
  });
  if (error) return { ok: false, error: "auth.unexpected" };
  refresh();
  return { ok: true };
}

export async function removeAttachment(
  lang: string,
  attachmentId: number,
): Promise<SimpleResult> {
  const supabase = await adminOnly(lang);
  const { data, error } = await supabase
    .from("page_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("file_path")
    .single();
  if (error || !data) return { ok: false, error: "auth.unexpected" };
  await supabase.storage.from("public-media").remove([data.file_path]);
  refresh();
  return { ok: true };
}
