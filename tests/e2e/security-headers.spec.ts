import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

// Step 6.2: security headers on every kind of response, and the pages still work under
// the Content Security Policy (no violations in the console).

const PAGES = [
  "/en",
  "/bn/notices",
  "/en/contact",
  "/en/teachers",
  "/en/login",
];

test("security headers are sent on pages, files and API routes", async ({
  request,
}) => {
  for (const url of [...PAGES, "/sitemap.xml", "/api/payments/webhook/nope"]) {
    const res = await request.get(url, { failOnStatusCode: false });
    const h = res.headers();
    // Each directive's exact value, so a loosened policy cannot pass unnoticed.
    const csp = Object.fromEntries(
      (h["content-security-policy"] ?? "")
        .split(";")
        .map((d) => d.trim().split(/\s+/))
        .map(([name, ...values]) => [name, values.join(" ")]),
    );
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    expect(csp, url).toMatchObject({
      "default-src": "'self'",
      "script-src": "'self' 'unsafe-inline'",
      "style-src": "'self' 'unsafe-inline'",
      "img-src": `'self' data: blob: ${supabase}`,
      "font-src": "'self' data:",
      "connect-src": `'self' ${supabase}`,
      "object-src": `'self' ${supabase}`,
      "frame-src": `'self' ${supabase} https://www.google.com https://maps.google.com`,
      "frame-ancestors": "'none'",
      "base-uri": "'self'",
      "form-action": "'self'",
    });
    expect(csp["script-src"], url).not.toContain("unsafe-eval");
    expect(h["strict-transport-security"], url).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(h["x-frame-options"], url).toBe("DENY");
    expect(h["x-content-type-options"], url).toBe("nosniff");
    expect(h["referrer-policy"], url).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], url).toContain("camera=()");
    expect(h["x-powered-by"], url).toBeUndefined();
  }
});

test("public and dashboard pages load without Content Security Policy violations", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text()))
      violations.push(`${page.url()}: ${m.text()}`);
  });
  // A notice with an inline PDF preview (object-src) and the contact map (frame-src).
  for (const url of [...PAGES, "/en/notices/annual-exam-routine-2026"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
  }
  await loginAs(page, "admin@sunrise.test");
  for (const url of [
    "/en/dashboard/admin",
    "/en/dashboard/notices/new",
    "/bn/dashboard/fees",
  ]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});
