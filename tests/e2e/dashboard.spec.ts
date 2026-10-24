import { expect, test } from "@playwright/test";

import { adminClient, loginAs, logout, TINY_PNG } from "./helpers";

test("dashboard works on a phone: menu opens, no sideways scrolling", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile-360", "phone layout only");
  await loginAs(page, "admin@sunrise.test");
  await expect(page).toHaveURL(/\/en\/dashboard\/admin$/);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Menu" }).click();
  const nav = page.getByRole("navigation", { name: "Dashboard navigation" });
  await expect(
    nav.getByRole("link", { name: "School settings" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "School settings" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/settings$/);
});

test("sidebar shows only the pages a role may open", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "desktop sidebar");
  await loginAs(page, "admin@sunrise.test");
  const nav = page.getByRole("navigation", { name: "Dashboard navigation" });
  await expect(nav.getByRole("link")).toHaveText(["Home", "School settings"]);
  await logout(page);

  await loginAs(page, "teacher@sunrise.test");
  await expect(nav.getByRole("link")).toHaveText(["Home"]);
});

test("the dashboard renders in Bangla", async ({ page }) => {
  await loginAs(page, "student@sunrise.test");
  await page.goto("/bn/dashboard/student");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "স্বাগতম, রহিম আহমেদ",
  );
});

test.describe("school settings", () => {
  test("a teacher cannot open settings", async ({ page }) => {
    await loginAs(page, "teacher@sunrise.test");
    const response = await page.goto("/en/dashboard/settings");
    expect(response?.status()).toBe(403);
  });

  test("changing the primary colour changes the site colour", async ({
    page,
  }) => {
    await loginAs(page, "admin@sunrise.test");
    const setColour = async (hex: string) => {
      await page.goto("/en/dashboard/settings");
      await page.getByLabel("Main colour").fill(hex);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Settings saved" }),
      ).toBeVisible();
    };
    const sitePrimary = async () => {
      await page.goto("/en");
      return page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim(),
      );
    };
    try {
      await setColour("#1d4ed8");
      expect(await sitePrimary()).toBe("#1d4ed8");
    } finally {
      await setColour("#0f766e");
    }
    expect(await sitePrimary()).toBe("#0f766e");
  });

  test("validation errors show in Bangla and nothing is saved", async ({
    page,
  }) => {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/bn/dashboard/settings");
    await page.getByLabel("ইআইআইএন").fill("12");
    await page.getByRole("button", { name: "সেটিংস সংরক্ষণ করুন" }).click();
    await expect(page.getByText("ইআইআইএন ৬ সংখ্যার।")).toBeVisible();
  });

  test("a logo upload is checked on the server by its content", async ({
    page,
  }) => {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/settings");
    // An SVG with a script, renamed to .png: the browser says image/png, the server says no.
    await page.getByLabel("Logo").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByText("The logo must be PNG, JPG or WebP."),
    ).toBeVisible();

    await page.getByLabel("Logo").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Settings saved" }),
    ).toBeVisible();
    await page.goto("/en");
    await expect(
      page.getByRole("img", { name: "Sunrise High School logo" }),
    ).toBeVisible();
    // The image really loads (not just an empty box).
    await expect
      .poll(() =>
        page
          .getByRole("img", { name: "Sunrise High School logo" })
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth,
          ),
      )
      .toBeGreaterThan(0);
    // Regression: saving without touching the colours must keep them (they once became black).
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    );
    expect(primary).toBe("#0f766e");
  });
});

// Leave the database as the seed made it: the logo test uploads a logo.
test.afterAll(async () => {
  await adminClient()
    .from("school_settings")
    .update({ logo_path: null })
    .eq("id", 1);
});
