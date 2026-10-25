"use server";

import { randomUUID } from "node:crypto";

import { revalidateTag } from "next/cache";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { detectImageType, IMAGE_MAX_BYTES, imageExtension } from "@/lib/files";
import { TAGS } from "@/lib/site/cache";
import { removeFiles } from "@/lib/storage-files";
import { readUpload } from "@/lib/uploads";
import { assertId, assertOptionalId } from "@/lib/validation/ids";
import { splitStaff, staffSchema } from "@/lib/validation/staff";

// The public directory, profiles, home page and sitemap show staff.
const refresh = () => revalidateTag(TAGS.staff);

/** Creates (id = null) or updates a member of staff and their private details. */
export async function saveStaff(
  lang: string,
  id: number | null,
  input: unknown,
): Promise<ActionResult> {
  assertOptionalId(id);
  const supabase = await requireAdmin(lang);
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const rows = splitStaff(parsed.data);

  const { data, error } =
    id === null
      ? await supabase.from("staff").insert(rows.staff).select("id").single()
      : await supabase
          .from("staff")
          .update(rows.staff)
          .eq("id", id)
          .select("id")
          .maybeSingle();
  if (error) return dbError(error);
  if (!data) return { ok: false, error: "errors.notAllowed" };
  const { error: privateError } = await supabase
    .from("staff_private")
    .upsert({ staff_id: data.id, ...rows.private });
  if (privateError) return dbError(privateError);
  refresh();
  return { ok: true, id: data.id };
}

/** Deletes a member of staff. Their login (if any) is switched off, not deleted. */
export async function deleteStaff(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data: staff } = await supabase
    .from("staff")
    .select("profile_id, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!staff) return { ok: false, error: "errors.notAllowed" };
  if (staff.profile_id) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", staff.profile_id);
    if (error) return { ok: false, error: "errors.notAllowed" };
  }
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) return dbError(error);
  await removeFiles(supabase, [staff.photo_path], [`staff/${id}/`]);
  refresh();
  return { ok: true };
}

export async function uploadStaffPhoto(
  lang: string,
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.imageType" };
  const { data: current } = await supabase
    .from("staff")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const folder = [`staff/${id}/`];
  const path = `staff/${id}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await supabase.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await supabase
    .from("staff")
    .update({ photo_path: path })
    .eq("id", id);
  if (error) {
    await removeFiles(supabase, [path], folder);
    return dbError(error);
  }
  await removeFiles(supabase, [current.photo_path], folder);
  refresh();
  return { ok: true };
}

export async function removeStaffPhoto(
  lang: string,
  id: number,
): Promise<ActionResult> {
  assertId(id);
  const supabase = await requireAdmin(lang);
  const { data: current } = await supabase
    .from("staff")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const { error } = await supabase
    .from("staff")
    .update({ photo_path: null })
    .eq("id", id);
  if (error) return dbError(error);
  await removeFiles(supabase, [current.photo_path], [`staff/${id}/`]);
  refresh();
  return { ok: true };
}
