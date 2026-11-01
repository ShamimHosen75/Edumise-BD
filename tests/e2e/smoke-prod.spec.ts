import { expect, test } from "@playwright/test";

// Step 6.4: the smoke subset to run against a deployed site (a Vercel preview or
// production). Read-only: it signs nobody in and changes nothing. Run with
//   E2E_BASE_URL=https://<site> npx playwright test tests/e2e/smoke-prod.spec.ts
// It also runs locally with the rest of the suite.

test.describe("@smoke", () => {
  test("health check says the database is reachable", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
  });

  for (const lang of ["en", "bn"] as const) {
    test(`public pages load in ${lang} with no console errors`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      for (const path of [
        "",
        "/notices",
        "/teachers",
        "/contact",
        "/admission/apply",
        "/result",
        "/routine",
        "/login",
      ]) {
        const res = await page.goto(`/${lang}${path}`);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator("main")).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }

  test("security headers, sitemap and robots are served", async ({
    request,
  }) => {
    const home = await request.get("/en");
    expect(home.headers()["content-security-policy"]).toContain(
      "frame-ancestors",
    );
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
    expect((await request.get("/robots.txt")).status()).toBe(200);
  });

  test("the dashboard needs a login and secrets stay server-side", async ({
    request,
  }) => {
    const res = await request.get("/en/dashboard", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/en/login");
    const api = await request.post("/api/revalidate", {
      data: { tags: ["stats"] },
    });
    expect(api.status()).toBe(401);
  });
});
