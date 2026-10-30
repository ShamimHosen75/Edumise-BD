import { manualProvider } from "./manual";
import { sandboxProvider } from "./sandbox";
import { bkashProvider, nagadProvider, sslcommerzProvider } from "./stubs";
import { PROVIDERS, type PaymentProvider, type ProviderName } from "./types";

const ALL: Record<ProviderName, PaymentProvider> = {
  manual: manualProvider,
  sandbox: sandboxProvider,
  bkash: bkashProvider,
  nagad: nagadProvider,
  sslcommerz: sslcommerzProvider,
};

export const isProvider = (v: string): v is ProviderName =>
  (PROVIDERS as readonly string[]).includes(v);

/** The provider by name (from a URL or the settings); null if there is none. */
export function getProvider(name: string): PaymentProvider | null {
  return isProvider(name) ? ALL[name] : null;
}

export * from "./types";
