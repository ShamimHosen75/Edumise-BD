"use server";

import { z } from "zod";

import { isLocale } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/t";
import { requireRole } from "@/lib/auth/session";
import { getProvider } from "@/lib/payments";
import { dbIntentStore } from "@/lib/payments/db-store";
import {
  SANDBOX_HEADER,
  sandboxProvider,
  sandboxTxnId,
  signSandbox,
} from "@/lib/payments/sandbox";
import { processWebhook } from "@/lib/payments/settle";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { ok: true; url: string }
  | { ok: true; instructions: true }
  | { ok: false; error: TranslationKey };

const id = z.number().int().positive();
const uuid = z.uuid();

/** "Pay now": a payment intent for everything the child owes, then the gateway. */
export async function startOnlinePayment(
  lang: string,
  studentId: unknown,
): Promise<Result> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["guardian", "student"]);
  const parsed = id.safeParse(studentId);
  if (!parsed.success) return { ok: false, error: "errors.notAllowed" };
  const db = await createClient();
  const { data, error } = await db.rpc("create_payment_intent", {
    p_student_id: parsed.data,
  });
  if (error?.code === "22023")
    return { ok: false, error: "fees.online.nothingDue" };
  if (error?.code === "55000")
    return { ok: false, error: "fees.online.switchedOff" };
  if (error || !data) return { ok: false, error: "errors.notAllowed" };
  const intent = data as { id: string; amount: number; provider: string };
  const provider = getProvider(intent.provider);
  if (!provider?.available())
    return { ok: false, error: "fees.online.unavailable" };
  const { data: st } = await db
    .from("students")
    .select("student_code")
    .eq("id", parsed.data)
    .single();
  const r = await provider.createPayment({
    id: intent.id,
    amount: intent.amount,
    studentCode: st?.student_code ?? "",
    lang,
  });
  return r.kind === "redirect"
    ? { ok: true, url: r.url }
    : { ok: true, instructions: true };
}

/**
 * The sandbox checkout's "Pay" / "Fail" buttons: play the gateway and send its signed
 * webhook, through the same code a real webhook takes.
 */
export async function sandboxPay(
  lang: string,
  intentId: unknown,
  outcome: unknown,
): Promise<Result> {
  if (!isLocale(lang)) throw new Error("Invalid language");
  await requireRole(lang, ["guardian", "student"]);
  const parsedId = uuid.safeParse(intentId);
  const parsedOutcome = z.enum(["paid", "failed"]).safeParse(outcome);
  if (
    !parsedId.success ||
    !parsedOutcome.success ||
    !sandboxProvider.available()
  )
    return { ok: false, error: "errors.notAllowed" };
  // RLS: only the family's own intent is found.
  const { data: intent } = await (
    await createClient()
  )
    .from("payment_intents")
    .select("id, amount, provider, status")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!intent || intent.provider !== "sandbox" || intent.status !== "created")
    return { ok: false, error: "fees.online.closed" };
  const event = {
    intentId: intent.id,
    providerTxnId: sandboxTxnId(),
    amount: intent.amount,
    status: parsedOutcome.data,
  };
  const r = await processWebhook(
    "sandbox",
    new Request("http://sandbox.local/api/payments/webhook/sandbox", {
      method: "POST",
      headers: { [SANDBOX_HEADER]: signSandbox(event) },
      body: JSON.stringify(event),
    }),
    dbIntentStore(),
  );
  if (r.status !== 200)
    return { ok: false, error: "fees.online.failedToRecord" };
  return { ok: true, url: `/${lang}/dashboard/payments/${intent.id}` };
}
