import { WebhookError, type PaymentProvider, type ProviderName } from "./types";

// Real gateways, not built yet: they report "not available" so the school cannot switch
// them on by mistake.
// TODO bKash: tokenized checkout (grant token, create payment, execute payment) with
//   BKASH_APP_KEY / BKASH_APP_SECRET / BKASH_USERNAME / BKASH_PASSWORD; verify with
//   "query payment" before trusting the callback.
// TODO Nagad: checkout initialize / complete with the merchant's RSA keys
//   (NAGAD_MERCHANT_ID, NAGAD_PUBLIC_KEY, NAGAD_PRIVATE_KEY); verify the callback.
// TODO SSLCommerz: session API with SSLCZ_STORE_ID / SSLCZ_STORE_PASSWORD; the IPN is the
//   webhook; validate every IPN with the validation API (val_id) before recording.
function notBuilt(name: ProviderName): PaymentProvider {
  return {
    name,
    available: () => false,
    async createPayment() {
      throw new Error(`${name} is not set up yet`);
    },
    async verifyPayment() {
      return null;
    },
    async handleWebhook() {
      throw new WebhookError(`${name} is not set up yet`, 404);
    },
  };
}

export const bkashProvider = notBuilt("bkash");
export const nagadProvider = notBuilt("nagad");
export const sslcommerzProvider = notBuilt("sslcommerz");
