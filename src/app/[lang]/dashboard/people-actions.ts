"use server";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { detectImageType, IMAGE_MAX_BYTES, imageExtension } from "@/lib/files";
import {
  isPeopleKind,
  PEOPLE_SCHEMAS,
  PEOPLE_TABLE,
  type PeopleKind,
} from "@/lib/people-admin";
import { TAGS } from "@/lib/site/cache";
import { createClient } from "@/lib/supabase/server";
import { readUpload } from "@/lib/uploads";

export type PersonSaveResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Record<string, TranslationKey>;
    };
export type PersonResult = { ok: true } | { ok: false; error: TranslationKey };

const TAG: Record<PeopleKind, string> = {
  "governing-body": TAGS.governing,
  "ex-principals": TAGS.exPrincipals,
};

/** Admins only (RLS agrees). Returns an untyped client for the run-time table name. */
async function admin(lang: string, kind: string) {
  if (!isLocale(lang) || !isPeopleKind(kind))
    throw new Error("Invalid request");
  await requireRole(lang, ["super_admin", "admin"]);
  const db = (await createClient()) as unknown as SupabaseClient;
  return { db, kind, table: PEOPLE_TABLE[kind] };
}

export async function savePerson(
  lang: string,
  kindName: string,
  id: number | null,
  input: unknown,
): Promise<PersonSaveResult> {
  const { db, kind, table } = await admin(lang, kindName);
  const parsed = PEOPLE_SCHEMAS[kind].safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, TranslationKey> = {};
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] ??= issue.message as TranslationKey;
    return { ok: false, error: "contentAdmin.failed", fieldErrors };
  }
  const row: Record<string, unknown> = { ...parsed.data };
  if ("term_end" in row) row.term_end = row.term_end || null;
  const { data, error } =
    id === null
      ? await db.from(table).insert(row).select("id").single()
      : await db.from(table).update(row).eq("id", id).select("id").single();
  if (error || !data) return { ok: false, error: "auth.unexpected" };
  revalidateTag(TAG[kind]);
  return { ok: true, id: data.id as number };
}

export async function deletePerson(
  lang: string,
  kindName: string,
  id: number,
): Promise<PersonResult> {
  const { db, kind, table } = await admin(lang, kindName);
  const { data, error } = await db
    .from(table)
    .delete()
    .eq("id", id)
    .select("photo_path");
  if (error || !data?.length) return { ok: false, error: "errors.notAllowed" };
  const photo = data[0]?.photo_path as string | null;
  if (photo && !photo.startsWith("demo/"))
    await db.storage.from("public-media").remove([photo]);
  revalidateTag(TAG[kind]);
  return { ok: true };
}

export async function uploadPersonPhoto(
  lang: string,
  kindName: string,
  id: number,
  formData: FormData,
): Promise<PersonResult> {
  const { db, kind, table } = await admin(lang, kindName);
  const read = await readUpload(formData, IMAGE_MAX_BYTES);
  if ("error" in read) return { ok: false, error: read.error };
  const type = detectImageType(read.bytes);
  if (!type) return { ok: false, error: "errors.imageType" };
  const { data: current } = await db
    .from(table)
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "errors.notAllowed" };
  const path = `people/${kind}/${randomUUID()}.${imageExtension(type)}`;
  const { error: uploadError } = await db.storage
    .from("public-media")
    .upload(path, read.bytes, { contentType: type });
  if (uploadError) return { ok: false, error: "errors.uploadFailed" };
  const { error } = await db
    .from(table)
    .update({ photo_path: path })
    .eq("id", id);
  if (error) return { ok: false, error: "auth.unexpected" };
  const old = current.photo_path as string | null;
  if (old && !old.startsWith("demo/"))
    await db.storage.from("public-media").remove([old]);
  revalidateTag(TAG[kind]);
  return { ok: true };
}

export async function removePersonPhoto(
  lang: string,
  kindName: string,
  id: number,
): Promise<PersonResult> {
  const { db, kind, table } = await admin(lang, kindName);
  const { data, error } = await db
    .from(table)
    .update({ photo_path: null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "errors.notAllowed" };
  revalidateTag(TAG[kind]);
  return { ok: true };
}
