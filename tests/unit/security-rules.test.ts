import { describe, expect, it } from "vitest";

import {
  canSetPasswordWithoutCurrent,
  isFreshRecoverySession,
  RECOVERY_WINDOW_SECONDS,
} from "@/lib/auth/password-policy";
import { clientIp, LIMITS, rateKey } from "@/lib/rate-limit-keys";

const NOW = 1_800_000_000;

describe("password change without the current password", () => {
  it("is allowed for a school-forced change", () => {
    expect(
      canSetPasswordWithoutCurrent({
        mustChangePassword: true,
        amr: [{ method: "password", timestamp: NOW }],
        nowSeconds: NOW,
      }),
    ).toBe(true);
  });
  it("is allowed right after a reset link", () => {
    for (const method of ["otp", "recovery"]) {
      expect(
        isFreshRecoverySession([{ method, timestamp: NOW - 60 }], NOW),
      ).toBe(true);
    }
  });
  it("is refused for a normal password session (e.g. a stolen cookie)", () => {
    expect(
      canSetPasswordWithoutCurrent({
        mustChangePassword: false,
        amr: [{ method: "password", timestamp: NOW }],
        nowSeconds: NOW,
      }),
    ).toBe(false);
  });
  it("is refused when the reset link session is older than 15 minutes", () => {
    const old = [
      { method: "otp", timestamp: NOW - RECOVERY_WINDOW_SECONDS - 1 },
    ];
    expect(
      canSetPasswordWithoutCurrent({
        mustChangePassword: false,
        amr: old,
        nowSeconds: NOW,
      }),
    ).toBe(false);
  });
  it("is refused when the token has no sign-in method", () => {
    for (const amr of [null, undefined, [], [{ method: "otp" }]]) {
      expect(
        canSetPasswordWithoutCurrent({
          mustChangePassword: false,
          amr,
          nowSeconds: NOW,
        }),
      ).toBe(false);
    }
  });
});

describe("rate limit keys", () => {
  const headers = (h: Record<string, string>) => new Headers(h);
  it("uses the first X-Forwarded-For address, then X-Real-IP", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })),
    ).toBe("203.0.113.5");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });
  it("puts unknown visitors in one shared bucket instead of none", () => {
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-forwarded-for": " " }))).toBe("unknown");
  });
  it("hashes values so no raw IP or email is stored", () => {
    const key = rateKey("login-fail", "Teacher@Sunrise.test ");
    expect(key).toMatch(/^login-fail:[0-9a-f]{64}$/);
    expect(key).not.toContain("sunrise");
    expect(key).toBe(rateKey("login-fail", "teacher@sunrise.test"));
    expect(rateKey("reset-email", "teacher@sunrise.test")).not.toBe(key);
  });
  it("is strict per account and generous per IP (a school lab shares one address)", () => {
    expect(LIMITS.loginFailuresPerAccount.max).toBeLessThanOrEqual(10);
    expect(LIMITS.loginPerIp.max).toBeGreaterThanOrEqual(100);
  });
});
