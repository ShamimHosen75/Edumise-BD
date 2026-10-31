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
    expect(h["content-security-policy"], url).toContain(
      "frame-ancestors 'none'",
    );
    expect(h["content-security-policy"], url).toContain("object-src");
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
