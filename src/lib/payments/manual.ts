import { WebhookError, type PaymentProvider } from "./types";

// No gateway: families are told to pay at the school office (the default).
export const manualProvider: PaymentProvider = {
  name: "manual",
  available: () => true,
  async createPayment() {
    return { kind: "instructions" };
  },
  async verifyPayment() {
    return null;
  },
  async handleWebhook() {
    throw new WebhookError("Manual payments have no webhook", 404);
  },
};
