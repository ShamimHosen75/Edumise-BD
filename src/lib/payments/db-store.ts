import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { IntentStore } from "./settle";

// Intents in the database, through the service role: the webhook has no user session.
// Every change goes through complete_payment_intent() / fail_payment_intent(), which
// lock the intent and check it again.
export function dbIntentStore(): IntentStore {
  const db = createAdminClient();
  return {
    async get(id) {
      const { data, error } = await db
        .from("payment_intents")
        .select("id, amount, provider, status, provider_txn_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? {
            id: data.id,
            amount: data.amount,
            provider: data.provider,
            status: data.status as "created" | "paid" | "failed",
            providerTxnId: data.provider_txn_id,
          }
        : null;
    },
    async complete(id, provider, txn, amount) {
      const { data, error } = await db.rpc("complete_payment_intent", {
        p_id: id,
        p_provider: provider,
        p_txn: txn,
        p_amount: amount,
      });
      if (error) throw new Error(error.message);
      return data as "recorded" | "duplicate" | "mismatch" | "unrecordable";
    },
    async fail(id, provider, reason) {
      const { error } = await db.rpc("fail_payment_intent", {
        p_id: id,
        p_provider: provider,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
    },
  };
}
