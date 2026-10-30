import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getProvider, isProvider } from "@/lib/payments";
import { manualProvider } from "@/lib/payments/manual";
import {
  readEvent,
  SANDBOX_HEADER,
  sandboxProvider,
  sandboxTxnId,
  signSandbox,
} from "@/lib/payments/sandbox";
import {
  processWebhook,
  settle,
  type IntentRecord,
  type IntentStore,
} from "@/lib/payments/settle";
import type { GatewayEvent } from "@/lib/payments/types";

const SECRET = "test-sandbox-secret-0123456789";
const ID = "8c3b2f4e-1a2b-4c3d-9e8f-001122334455";

/** An in-memory store that behaves like complete_payment_intent(). */
function memoryStore(intent: IntentRecord) {
  const recorded: { txn: string; amount: number }[] = [];
  const store: IntentStore = {
    async get(id) {
      return id === intent.id ? { ...intent } : null;
    },
    async complete(_id, _provider, txn, amount) {
      if (intent.status === "paid")
        return intent.providerTxnId === txn ? "duplicate" : "mismatch";
      if (amount !== intent.amount) {
        intent.status = "failed";
        return "mismatch";
      }
      recorded.push({ txn, amount });
      intent.status = "paid";
      intent.providerTxnId = txn;
      return "recorded";
    },
    async fail() {
      if (intent.status === "created") intent.status = "failed";
    },
  };
  return { store, recorded, intent };
}

const intent = (): IntentRecord => ({
  id: ID,
  amount: 60000,
  provider: "sandbox",
  status: "created",
  providerTxnId: null,
});

function webhook(e: GatewayEvent, signature = signSandbox(e, SECRET)) {
  return new Request("http://localhost/api/payments/webhook/sandbox", {
    method: "POST",
    headers: { [SANDBOX_HEADER]: signature },
    body: JSON.stringify(e),
  });
}

const paid = (over: Partial<GatewayEvent> = {}): GatewayEvent => ({
  intentId: ID,
  providerTxnId: "SBX-0011AABB",
  amount: 60000,
  status: "paid",
  ...over,
});

beforeEach(() => {
  process.env.PAYMENT_SANDBOX_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.PAYMENT_SANDBOX_SECRET;
});

describe("webhook with the sandbox gateway", () => {
  it("records a payment once, however often the webhook comes (idempotent)", async () => {
    const { store, recorded } = memoryStore(intent());
    const first = await processWebhook("sandbox", webhook(paid()), store);
    const again = await processWebhook("sandbox", webhook(paid()), store);
    expect(first).toEqual({
      status: 200,
      body: { ok: true, outcome: "recorded" },
    });
    expect(again).toEqual({
      status: 200,
      body: { ok: true, outcome: "duplicate" },
    });
    expect(recorded).toEqual([{ txn: "SBX-0011AABB", amount: 60000 }]);
  });
  it("refuses another transaction for an intent already paid", async () => {
    const { store, recorded } = memoryStore(intent());
    await processWebhook("sandbox", webhook(paid()), store);
    const other = await processWebhook(
      "sandbox",
      webhook(paid({ providerTxnId: "SBX-FFFF0000" })),
      store,
    );
    expect(other).toEqual({ status: 409, body: { error: "already_paid" } });
    expect(recorded).toHaveLength(1);
  });
  it("rejects a different amount and records nothing", async () => {
    const m = memoryStore(intent());
    const r = await processWebhook(
      "sandbox",
      webhook(paid({ amount: 59999 })),
      m.store,
    );
    expect(r).toEqual({ status: 409, body: { error: "amount_mismatch" } });
    expect(m.recorded).toEqual([]);
    expect(m.intent.status).toBe("failed");
    // The right amount later is still refused: the intent is closed.
    const more = await processWebhook(
      "sandbox",
      webhook(paid({ amount: 60001 })),
      m.store,
    );
    expect(more.body).toEqual({ error: "amount_mismatch" });
    expect(m.recorded).toEqual([]);
  });
  it("refuses a forged or missing signature", async () => {
    const { store, recorded } = memoryStore(intent());
    const forged = signSandbox(paid({ amount: 1 }), SECRET);
    expect(
      (await processWebhook("sandbox", webhook(paid(), forged), store)).status,
    ).toBe(401);
    expect(
      (await processWebhook("sandbox", webhook(paid(), "zz"), store)).status,
    ).toBe(401);
    expect(
      (
        await processWebhook(
          "sandbox",
          webhook(paid(), signSandbox(paid(), "another-secret-0123456")),
          store,
        )
      ).status,
    ).toBe(401);
    expect(recorded).toEqual([]);
  });
  it("refuses bad bodies, unknown intents and providers", async () => {
    const { store } = memoryStore(intent());
    const notJson = new Request("http://x", { method: "POST", body: "{" });
    expect((await processWebhook("sandbox", notJson, store)).status).toBe(400);
    const odd = new Request("http://x", {
      method: "POST",
      body: '{"amount":"x"}',
    });
    expect((await processWebhook("sandbox", odd, store)).status).toBe(400);
    const other = paid({ intentId: "00000000-0000-4000-a000-000000000000" });
    expect(await processWebhook("sandbox", webhook(other), store)).toEqual({
      status: 404,
      body: { error: "unknown_intent" },
    });
    for (const p of ["nope", "manual", "bkash", "nagad", "sslcommerz"])
      expect((await processWebhook(p, webhook(paid()), store)).status).toBe(
        404,
      );
  });
  it("is switched off without its secret", async () => {
    delete process.env.PAYMENT_SANDBOX_SECRET;
    const { store } = memoryStore(intent());
    expect(sandboxProvider.available()).toBe(false);
    expect(
      (await processWebhook("sandbox", webhook(paid(), "0".repeat(64)), store))
        .status,
    ).toBe(404);
    expect(() => signSandbox(paid())).toThrow();
  });
  it("marks a failed payment failed", async () => {
    const m = memoryStore(intent());
    const r = await processWebhook(
      "sandbox",
      webhook(paid({ status: "failed" })),
      m.store,
    );
    expect(r.body).toEqual({ ok: true, outcome: "failed" });
    expect(m.intent.status).toBe("failed");
  });
  it("an intent of another provider is not this one's", async () => {
    const { store } = memoryStore({ ...intent(), provider: "bkash" });
    expect(await settle(sandboxProvider, paid(), store)).toEqual({
      ok: false,
      code: "wrong_provider",
    });
  });
});

describe("providers", () => {
  it("sandbox sends the payer to its checkout page and verifies the return", async () => {
    expect(
      await sandboxProvider.createPayment({
        id: ID,
        amount: 100,
        studentCode: "2026060001",
        lang: "bn",
      }),
    ).toEqual({
      kind: "redirect",
      url: `/bn/dashboard/payments/${ID}/sandbox`,
    });
    const e = paid();
    const params = {
      ...e,
      amount: String(e.amount),
      signature: signSandbox(e),
    };
    expect(await sandboxProvider.verifyPayment(params)).toEqual(e);
    expect(
      await sandboxProvider.verifyPayment({ ...params, amount: "1" }),
    ).toBeNull();
  });
  it("manual means pay at the office", async () => {
    expect(
      await manualProvider.createPayment({
        id: ID,
        amount: 1,
        studentCode: "",
        lang: "en",
      }),
    ).toEqual({
      kind: "instructions",
    });
    expect(await manualProvider.verifyPayment({})).toBeNull();
  });
  it("real gateways are not set up yet", async () => {
    for (const name of ["bkash", "nagad", "sslcommerz"]) {
      const p = getProvider(name)!;
      expect(p.available()).toBe(false);
      await expect(
        p.createPayment({ id: ID, amount: 1, studentCode: "", lang: "en" }),
      ).rejects.toThrow();
      expect(await p.verifyPayment({})).toBeNull();
    }
    expect(getProvider("paypal")).toBeNull();
    expect(isProvider("sandbox")).toBe(true);
  });
  it("transaction IDs and event fields", () => {
    expect(sandboxTxnId()).toMatch(/^SBX-[0-9A-F]{16}$/);
    expect(readEvent({ ...paid(), amount: "60000" })?.amount).toBe(60000);
    expect(readEvent({ ...paid(), status: "maybe" })).toBeNull();
    expect(readEvent({ ...paid(), amount: -1 })).toBeNull();
    expect(readEvent({ ...paid(), providerTxnId: "a b" })).toBeNull();
  });
});
