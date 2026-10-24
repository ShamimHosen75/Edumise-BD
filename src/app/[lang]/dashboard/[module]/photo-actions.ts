"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { authorize, refreshModule, removeFiles } from "@/lib/content/server";
import { detectImageType, IMAGE_MAX_BYTES, imageExtension } from "@/lib/files";
import { readUpload } from "@/lib/uploads";

import type { SimpleResult } from "./actions";

// Album photos (admins only: the gallery module is admin-only, and RLS agrees).

const gallery = (lang: string) => authorize(lang, "gallery");

/** Adds one photo (already resized to WebP in the browser; checked again here). */
export async function addAlbumPhoto(
  lang: string,
  albumId: number,
  formData: FormData,
): Promise<SimpleResult> {
  const { db } = await gallery(lang);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.imageType" };

  const { data: album } = await db
    .from("gallery_albums")
    .select("id, cover_path")
    .eq("id", albumId)
    .maybeSingle();
  if (!album) return { ok: false, error: "errors.notAllowed" };
  const { data: last } = await db
    .from("gallery_images")
    .select("sort_order")
    .eq("album_id", albumId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const path = `gallery/${albumId}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await db.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const caption = (key: string) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, 200);
  const { error } = await db.from("gallery_images").insert({
    album_id: albumId,
    image_path: path,
    caption_en: caption("caption_en"),
    caption_bn: caption("caption_bn"),
    sort_order: Math.min(
      ((last?.sort_order as number | undefined) ?? -1) + 1,
      32767,
    ),
  });
  if (error) {
    await removeFiles(db, [path]);
    return { ok: false, error: "auth.unexpected" };
  }
  // The first photo becomes the cover when the album has none.
  if (!album.cover_path)
    await db
      .from("gallery_albums")
      .update({ cover_path: path })
      .eq("id", albumId);
  refreshModule("gallery");
  return { ok: true };
}

const captionSchema = z.object({
  caption_en: z.string().trim().max(200, "errors.tooLong"),
  caption_bn: z.string().trim().max(200, "errors.tooLong"),
});

export async function savePhotoCaption(
  lang: string,
  photoId: number,
  input: unknown,
): Promise<SimpleResult> {
  const { db } = await gallery(lang);
  const parsed = captionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.tooLong" };
  const { data, error } = await db
    .from("gallery_images")
    .update(parsed.data)
    .eq("id", photoId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "errors.notAllowed" };
  refreshModule("gallery");
  return { ok: true };
}

export async function removeAlbumPhoto(
  lang: string,
  photoId: number,
): Promise<SimpleResult> {
  const { db } = await gallery(lang);
  const { data, error } = await db
    .from("gallery_images")
    .delete()
    .eq("id", photoId)
    .select("album_id, image_path");
  const photo = data?.[0];
  if (error || !photo) return { ok: false, error: "errors.notAllowed" };
  // Clear the cover if it was this photo.
  await db
    .from("gallery_albums")
    .update({ cover_path: null })
    .eq("id", photo.album_id)
    .eq("cover_path", photo.image_path);
  await removeFiles(db, [photo.image_path]);
  refreshModule("gallery");
  return { ok: true };
}

export async function setAlbumCover(
  lang: string,
  photoId: number,
): Promise<SimpleResult> {
  const { db } = await gallery(lang);
  const { data: photo } = await db
    .from("gallery_images")
    .select("album_id, image_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "errors.notAllowed" };
  const { error } = await db
    .from("gallery_albums")
    .update({ cover_path: photo.image_path })
    .eq("id", photo.album_id);
  if (error) return { ok: false, error: "auth.unexpected" };
  refreshModule("gallery");
  return { ok: true };
}
