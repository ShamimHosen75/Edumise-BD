import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  WebhookError,
  type GatewayEvent,
  type PaymentIntent,
  type PaymentProvider,
} from "./types";

// A pretend gateway for testing and demos: our own checkout page plays the gateway and
// sends a webhook signed with PAYMENT_SANDBOX_SECRET (HMAC-SHA256). It is available
// only when that secret is set, so a live site without it cannot take sandbox payments.

export const SANDBOX_HEADER = "x-sandbox-signature";

/**
 * Never on the live site, even if the secret is set there by mistake: not on Vercel
 * production, and not on a public https address (self-hosted) unless
 * PAYMENT_SANDBOX_ALLOW_LIVE=1 is set on purpose (A5, Step 6.2).
 */
export function sandboxAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  const site = env.NEXT_PUBLIC_SITE_URL ?? "";
  const live =
    /^https:\/\//.test(site) &&
    !/^https:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(site);
  return !live || env.PAYMENT_SANDBOX_ALLOW_LIVE === "1";
}

const secret = () =>
  sandboxAllowed() ? (process.env.PAYMENT_SANDBOX_SECRET ?? "") : "";

const payload = (e: GatewayEvent) =>
  `${e.intentId}|${e.providerTxnId}|${e.amount}|${e.status}`;

/** The signature of an event (what the sandbox "gateway" sends). */
export function signSandbox(e: GatewayEvent, key = secret()): string {
  if (key.length < 16) throw new Error("PAYMENT_SANDBOX_SECRET is not set");
  return createHmac("sha256", key).update(payload(e)).digest("hex");
}

function verified(e: GatewayEvent, signature: string, key = secret()) {
  if (key.length < 16 || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const want = Buffer.from(signSandbox(e, key), "hex");
  return timingSafeEqual(want, Buffer.from(signature, "hex"));
}

/** A new sandbox transaction ID, like a gateway's. */
export const sandboxTxnId = () =>
  `SBX-${randomBytes(8).toString("hex").toUpperCase()}`;

/** Reads an event from untrusted fields; null if a field is missing or malformed. */
export function readEvent(v: Record<string, unknown>): GatewayEvent | null {
  const amount = Number(v.amount);
  if (
    typeof v.intentId !== "string" ||
    !/^[0-9a-f-]{36}$/.test(v.intentId) ||
    typeof v.providerTxnId !== "string" ||
    !/^[A-Za-z0-9-]{4,60}$/.test(v.providerTxnId) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    (v.status !== "paid" && v.status !== "failed")
  )
    return null;
  return {
    intentId: v.intentId,
    providerTxnId: v.providerTxnId,
    amount,
    status: v.status,
  };
}

export const sandboxProvider: PaymentProvider = {
  name: "sandbox",
  available: () => secret().length >= 16,
  async createPayment(intent: PaymentIntent) {
    return {
      kind: "redirect",
      url: `/${intent.lang}/dashboard/payments/${intent.id}/sandbox`,
    };
  },
  async verifyPayment(params) {
    const e = readEvent(params);
    return e && verified(e, params.signature ?? "") ? e : null;
  },
  async handleWebhook(request) {
    const signature = request.headers.get(SANDBOX_HEADER) ?? "";
    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      throw new WebhookError("Not JSON");
    }
    const e =
      body && typeof body === "object"
        ? readEvent(body as Record<string, unknown>)
        : null;
    if (!e) throw new WebhookError("Bad payment details");
    if (!verified(e, signature)) throw new WebhookError("Bad signature", 401);
    return e;
  },
};
