"use server";

import { revalidateTag } from "next/cache";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { TAGS } from "@/lib/site/cache";
import { moveItem, nextSortOrder } from "@/lib/site/reorder";
import { createClient } from "@/lib/supabase/server";
import { assertId } from "@/lib/validation/ids";
import {
  menuItemColumns,
  menuItemSchema,
  type MenuItemInput,
} from "@/lib/validation/page";

export type MenuResult =
  | { ok: true }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Partial<Record<keyof MenuItemInput, string>>;
    };

async function adminOnly(lang: string) {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["super_admin", "admin"]);
  return createClient();
}

function parse(
  input: unknown,
): { ok: true; value: MenuItemInput } | { ok: false; result: MenuResult } {
  const parsed = menuItemSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fieldErrors: Partial<Record<keyof MenuItemInput, string>> = {};
  for (const issue of parsed.error.issues)
    fieldErrors[issue.path[0] as keyof MenuItemInput] ??= issue.message;
  return { ok: false, result: { ok: false, error: "cms.failed", fieldErrors } };
}

async function allItems(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("menu_items")
    .select("id, parent_id, sort_order");
  return data ?? [];
}

export async function createMenuItem(
  lang: string,
  input: unknown,
): Promise<MenuResult> {
  const supabase = await adminOnly(lang);
  const parsed = parse(input);
  if (!parsed.ok) return parsed.result;
  const sort_order = nextSortOrder(
    await allItems(supabase),
    parsed.value.parent_id,
  );
  const { error } = await supabase
    .from("menu_items")
    .insert({ ...menuItemColumns(parsed.value), sort_order });
  if (error) return { ok: false, error: "auth.unexpected" };
  revalidateTag(TAGS.menu);
  return { ok: true };
}

export async function updateMenuItem(
  lang: string,
  id: number,
  input: unknown,
): Promise<MenuResult> {
  assertId(id);
  const supabase = await adminOnly(lang);
  const parsed = parse(input);
  if (!parsed.ok) return parsed.result;
  // The level of an item does not change when it is edited.
  const columns: Partial<ReturnType<typeof menuItemColumns>> = menuItemColumns(
    parsed.value,
  );
  delete columns.parent_id;
  const { data, error } = await supabase
    .from("menu_items")
    .update(columns)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "auth.unexpected" };
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  revalidateTag(TAGS.menu);
  return { ok: true };
}

export async function moveMenuItem(
  lang: string,
  id: number,
  direction: "up" | "down",
): Promise<MenuResult> {
  assertId(id);
  const supabase = await adminOnly(lang);
  if (direction !== "up" && direction !== "down")
    return { ok: false, error: "auth.unexpected" };
  const results = await Promise.all(
    moveItem(await allItems(supabase), id, direction).map((change) =>
      supabase
        .from("menu_items")
        .update({ sort_order: change.sort_order })
        .eq("id", change.id),
    ),
  );
  if (results.some((r) => r.error))
    return { ok: false, error: "auth.unexpected" };
  revalidateTag(TAGS.menu);
  return { ok: true };
}

export async function deleteMenuItem(
  lang: string,
  id: number,
): Promise<MenuResult> {
  assertId(id);
  const supabase = await adminOnly(lang);
  const { data, error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "auth.unexpected" };
  if (!data.length) return { ok: false, error: "errors.notAllowed" };
  revalidateTag(TAGS.menu);
  return { ok: true };
}
