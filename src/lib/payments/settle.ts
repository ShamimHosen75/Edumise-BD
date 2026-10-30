import { getProvider } from "./index";
import { WebhookError, type GatewayEvent, type PaymentProvider } from "./types";

// Turning a gateway webhook into a recorded payment, once. The database does the same
// checks again in complete_payment_intent(), inside one transaction.

export type IntentRecord = {
  id: string;
  amount: number;
  provider: string;
  status: "created" | "paid" | "failed";
  providerTxnId: string | null;
};

/** Where intents live (the database; a Map in unit tests). */
export interface IntentStore {
  get(id: string): Promise<IntentRecord | null>;
  complete(
    id: string,
    provider: string,
    txn: string,
    amount: number,
  ): Promise<"recorded" | "duplicate" | "mismatch" | "unrecordable">;
  fail(id: string, provider: string, reason: string): Promise<void>;
}

export type SettleResult =
  | { ok: true; outcome: "recorded" | "duplicate" | "failed" }
  | {
      ok: false;
      code:
        | "unknown_intent"
        | "wrong_provider"
        | "amount_mismatch"
        | "already_paid"
        | "unrecordable";
    };

/** Applies one verified gateway event to its intent. */
export async function settle(
  provider: PaymentProvider,
  e: GatewayEvent,
  store: IntentStore,
): Promise<SettleResult> {
  const intent = await store.get(e.intentId);
  if (!intent) return { ok: false, code: "unknown_intent" };
  if (intent.provider !== provider.name)
    return { ok: false, code: "wrong_provider" };
  if (intent.status === "paid")
    return intent.providerTxnId === e.providerTxnId
      ? { ok: true, outcome: "duplicate" }
      : { ok: false, code: "already_paid" };
  if (e.status === "failed") {
    await store.fail(intent.id, provider.name, "gateway_failed");
    return { ok: true, outcome: "failed" };
  }
  if (e.amount !== intent.amount) {
    // Record nothing; the store marks the intent failed for the office to look at.
    await store.complete(intent.id, provider.name, e.providerTxnId, e.amount);
    return { ok: false, code: "amount_mismatch" };
  }
  const r = await store.complete(
    intent.id,
    provider.name,
    e.providerTxnId,
    e.amount,
  );
  if (r === "mismatch") return { ok: false, code: "amount_mismatch" };
  if (r === "unrecordable") return { ok: false, code: "unrecordable" };
  return { ok: true, outcome: r };
}

const STATUS: Record<Extract<SettleResult, { ok: false }>["code"], number> = {
  unknown_intent: 404,
  wrong_provider: 404,
  amount_mismatch: 409,
  already_paid: 409,
  unrecordable: 409,
};

/** The whole webhook: find the provider, verify the message, settle it. */
export async function processWebhook(
  providerName: string,
  request: Request,
  store: IntentStore,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const provider = getProvider(providerName);
  if (!provider || !provider.available())
    return { status: 404, body: { error: "unknown_provider" } };
  let event: GatewayEvent;
  try {
    event = await provider.handleWebhook(request);
  } catch (error) {
    return error instanceof WebhookError
      ? { status: error.status, body: { error: error.message } }
      : { status: 400, body: { error: "bad_request" } };
  }
  const r = await settle(provider, event, store);
  return r.ok
    ? { status: 200, body: { ok: true, outcome: r.outcome } }
    : { status: STATUS[r.code], body: { error: r.code } };
}
