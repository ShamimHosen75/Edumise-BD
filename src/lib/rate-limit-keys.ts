import { createHash } from "node:crypto";

/** Limits used across the app. Generous per IP (a school lab shares one IP), strict per account. */
export const LIMITS = {
  loginPerIp: { max: 300, windowSeconds: 5 * 60 },
  // Failures per account from one address (A1, Step 6.2): someone guessing from one place
  // is stopped, but cannot lock the real owner out from another place…
  loginFailuresPerAccount: { max: 10, windowSeconds: 15 * 60 },
  // …and a much higher cap per account from everywhere, against spread-out guessing.
  loginFailuresPerAccountTotal: { max: 100, windowSeconds: 60 * 60 },
  resetPerIp: { max: 10, windowSeconds: 60 * 60 },
  resetPerEmail: { max: 3, windowSeconds: 60 * 60 },
  // A results day means many searches from one school lab, but no stepping through rolls.
  resultPerIp: { max: 60, windowSeconds: 10 * 60 },
  // ...and a daily cap, so one address cannot step through every roll of the school.
  resultPerIpDay: { max: 300, windowSeconds: 24 * 60 * 60 },
  // Certificate checks: offices verifying a few papers, not stepping through references.
  verifyPerIp: { max: 60, windowSeconds: 10 * 60 },
  // Online payments: a guardian starts a few payments, not hundreds.
  payPerAccount: { max: 20, windowSeconds: 60 * 60 },
} as const;

/**
 * The visitor's IP (A3, Step 6.2). On Vercel, `x-vercel-forwarded-for` is set by the
 * platform and cannot be faked. Behind another proxy, set TRUSTED_PROXY_HOPS to the number
 * of proxies in front of the app: the address that many entries from the right of
 * X-Forwarded-For is used (entries further left can be written by the client).
 * Without either, the first X-Forwarded-For entry (local development and tests).
 * Unknown IPs share one bucket rather than being unlimited.
 */
export function clientIp(
  headers: Pick<Headers, "get">,
  trustedHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0),
): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hops =
    Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 0;
  const forwarded = hops ? chain[Math.max(0, chain.length - hops)] : chain[0];
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Login failure counters (A1, A2, Step 6.2), keyed by the account the identifier
 * resolves to (its email), so a student ID and its sign-in address share one counter:
 * one per account and address, one per account from everywhere.
 */
export function loginFailureKeys(account: string, ip: string) {
  const id = account.trim().toLowerCase();
  return {
    fromThisIp: rateKey("login-fail", `${id}|${ip}`),
    total: rateKey("login-fail-all", id),
  };
}

/** Hashed key, so the table never stores a raw IP address or email. */
export function rateKey(scope: string, value: string): string {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
  return `${scope}:${digest}`;
}
