import { describe, expect, it } from "vitest";

import { sandboxAllowed } from "@/lib/payments/sandbox";
import { clientIp, loginFailureKeys } from "@/lib/rate-limit-keys";
import { sanitizeRichText } from "@/lib/sanitize";

// Step 6.2 security audit: regression tests (docs/security-report.md).

const h = (o: Record<string, string>) => new Headers(o);

describe("A3: the visitor's address", () => {
  it("on Vercel, the platform's header wins over a spoofed X-Forwarded-For", () => {
    expect(
      clientIp(
        h({
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-forwarded-for": "1.1.1.1",
        }),
      ),
    ).toBe("203.0.113.9");
  });
  it("behind N trusted proxies, the entry N from the right is used", () => {
    const xff = h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" });
    expect(clientIp(xff, 2)).toBe("203.0.113.9");
    expect(clientIp(xff, 1)).toBe("10.0.0.2");
    expect(clientIp(xff, 9)).toBe("6.6.6.6");
  });
  it("without a proxy setting, the first entry; nothing at all shares one bucket", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), 0)).toBe(
      "1.2.3.4",
    );
    expect(clientIp(h({ "x-real-ip": "9.9.9.9" }), 0)).toBe("9.9.9.9");
    expect(clientIp(h({}), 0)).toBe("unknown");
  });
});

describe("A1, A2: login failure counters", () => {
  it("one account shares its counters however it is typed", () => {
    const a = loginFailureKeys("Student-2026060001@student.invalid", "1.1.1.1");
    const b = loginFailureKeys(
      " student-2026060001@student.invalid ",
      "1.1.1.1",
    );
    expect(a).toEqual(b);
  });
  it("failures from one address do not lock the owner out from another", () => {
    const attacker = loginFailureKeys("guardian@example.com", "6.6.6.6");
    const owner = loginFailureKeys("guardian@example.com", "203.0.113.9");
    expect(attacker.fromThisIp).not.toBe(owner.fromThisIp);
    // …while the much higher total cap still counts both.
    expect(attacker.total).toBe(owner.total);
  });
});

describe("A7: images in rich text", () => {
  const MEDIA = "https://abc.supabase.co";
  const img = (path: string) =>
    sanitizeRichText(`<p>x</p><img src="${MEDIA}${path}">`, {
      mediaBaseUrl: MEDIA,
    });
  it("keeps images of the school's bucket", () => {
    expect(img("/storage/v1/object/public/public-media/a.png")).toContain(
      "<img",
    );
  });
  it("drops paths that step out of the bucket, plain or encoded", () => {
    for (const p of [
      "/storage/v1/object/public/public-media/../../../../auth/v1/x",
      "/storage/v1/object/public/public-media/%2e%2e/%2e%2e/auth/v1/x",
      "/storage/v1/object/public/public-media/..%2f..%2fauth",
    ])
      expect(img(p), p).not.toContain("<img");
  });
});

describe("A5: the test payment gateway", () => {
  it("is allowed locally and on preview sites", () => {
    expect(
      sandboxAllowed({
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toBe(true);
    expect(
      sandboxAllowed({
        NEXT_PUBLIC_SITE_URL: "https://localhost:3000",
      }),
    ).toBe(true);
  });
  it("is refused on a live site unless allowed on purpose", () => {
    const live = {
      NEXT_PUBLIC_SITE_URL: "https://school.edu.bd",
    };
    expect(sandboxAllowed(live)).toBe(false);
    expect(sandboxAllowed({ ...live, PAYMENT_SANDBOX_ALLOW_LIVE: "1" })).toBe(
      true,
    );
    expect(sandboxAllowed({ VERCEL_ENV: "production" })).toBe(false);
  });
});
