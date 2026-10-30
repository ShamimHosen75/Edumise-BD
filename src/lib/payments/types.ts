// Online payment gateways behind one interface (FEE-05). A provider starts a payment,
// checks a payment the gateway sends the payer back with, and reads its webhook.

export const PROVIDERS = [
  "manual",
  "sandbox",
  "bkash",
  "nagad",
  "sslcommerz",
] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/** What the gateway is asked to collect. Amounts are whole poisha. */
export type PaymentIntent = {
  id: string;
  amount: number;
  studentCode: string;
  lang: "en" | "bn";
};

/** Where to send the payer: the gateway's page, or instructions to pay at school. */
export type CreateResult =
  { kind: "redirect"; url: string } | { kind: "instructions" };

/** A verified message from a gateway about one intent. */
export type GatewayEvent = {
  intentId: string;
  providerTxnId: string;
  amount: number;
  status: "paid" | "failed";
};

export interface PaymentProvider {
  readonly name: ProviderName;
  /** False when the provider is not set up (no keys) or not built yet. */
  available(): boolean;
  createPayment(intent: PaymentIntent): Promise<CreateResult>;
  /** Checks the signed details a gateway sends the payer back with; null if forged. */
  verifyPayment(params: Record<string, string>): Promise<GatewayEvent | null>;
  /** Reads and verifies a webhook; throws WebhookError when it cannot be trusted. */
  handleWebhook(request: Request): Promise<GatewayEvent>;
}

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 = 400,
  ) {
    super(message);
  }
}
