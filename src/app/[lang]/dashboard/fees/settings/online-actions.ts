"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  dbError,
  invalid,
  requireAdmin,
  type ActionResult,
} from "@/lib/actions";
import { getProvider, PROVIDERS } from "@/lib/payments";

const schema = z.object({
  online_payment_enabled: z.boolean(),
  payment_provider: z.enum(PROVIDERS),
});

/** Switches online payment and picks the gateway (admins). */
export async function saveOnlinePayment(
  lang: string,
  input: unknown,
): Promise<ActionResult> {
  const db = await requireAdmin(lang);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // A gateway that is not set up cannot be chosen.
  if (!getProvider(parsed.data.payment_provider)?.available())
    return {
      ok: false,
      error: "fees.online.unavailable",
      fieldErrors: { payment_provider: "fees.online.unavailable" },
    };
  const { data, error } = await db
    .from("fee_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return dbError(error);
  revalidatePath(`/${lang}/dashboard`, "layout");
  return data.length ? { ok: true } : { ok: false, error: "errors.notAllowed" };
}
