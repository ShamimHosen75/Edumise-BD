"use server";

import { revalidateTag } from "next/cache";

import type { TranslationKey } from "@/i18n/t";
import { dbError, invalid, requireAdmin } from "@/lib/actions";
import { TAGS } from "@/lib/site/cache";
import { promotionSchema } from "@/lib/validation/student";

export type PromotionResult =
  | { ok: true; count: number }
  | {
      ok: false;
      error: TranslationKey;
      fieldErrors?: Record<string, TranslationKey>;
    };

/** Creates next session's enrolments for one class (one database transaction). */
export async function promoteClass(
  lang: string,
  input: unknown,
): Promise<PromotionResult> {
  const supabase = await requireAdmin(lang);
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as PromotionResult;
  const v = parsed.data;
  const { data, error } = await supabase.rpc("promote_students", {
    p_from_session: v.from_session,
    p_to_session: v.to_session,
    p_class_id: v.class_id,
    p_decisions: v.decisions,
  });
  if (error?.code === "23505") return { ok: false, error: "errors.enrolled" };
  if (error?.code === "22023")
    return { ok: false, error: "promotion.sameSession" };
  if (error) return dbError(error) as PromotionResult;
  revalidateTag(TAGS.stats);
  return { ok: true, count: data };
}
