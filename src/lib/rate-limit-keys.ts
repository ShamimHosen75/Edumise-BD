import { createHash } from "node:crypto";

/** Limits used across the app. Generous per IP (a school lab shares one IP), strict per account. */
export const LIMITS = {
  loginPerIp: { max: 300, windowSeconds: 5 * 60 },
  loginFailuresPerAccount: { max: 10, windowSeconds: 15 * 60 },
  resetPerIp: { max: 10, windowSeconds: 60 * 60 },
  resetPerEmail: { max: 3, windowSeconds: 60 * 60 },
  // A results day means many searches from one school lab, but no stepping through rolls.
  resultPerIp: { max: 60, windowSeconds: 10 * 60 },
  // ...and a daily cap, so one address cannot step through every roll of the school.
  resultPerIpDay: { max: 300, windowSeconds: 24 * 60 * 60 },
  // Certificate checks: offices verifying a few papers, not stepping through references.
  verifyPerIp: { max: 60, windowSeconds: 10 * 60 },
} as const;

/**
 * The visitor's IP. On Vercel the first X-Forwarded-For entry is the client; X-Real-IP is
 * a fallback. Unknown IPs share one bucket rather than being unlimited.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Hashed key, so the table never stores a raw IP address or email. */
export function rateKey(scope: string, value: string): string {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
  return `${scope}:${digest}`;
}
