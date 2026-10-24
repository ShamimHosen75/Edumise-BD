import { expect, test } from "@playwright/test";

test.describe("language selection", () => {
  test.describe("Bangla browser", () => {
    test.use({ locale: "bn-BD" });
    test("/ goes to /bn using Accept-Language", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/bn$/);
    });
  });

  test("a saved language cookie wins over the browser language", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "bn", url: baseURL! },
    ]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/bn$/);
  });

  test("switching language keeps the path and is remembered", async ({
    page,
  }) => {
    const first = await page.goto("/en/about-us");
    expect(first?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );

    await page.goto("/en");
    await page.getByRole("link", { name: /বাংলা/ }).click();
    await expect(page).toHaveURL(/\/bn$/);

    // From a deeper path the rest of the path is kept.
    await page.goto("/bn/some/deep/path");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "পৃষ্ঠাটি পাওয়া যায়নি",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");

    // The choice is remembered for the next visit to /.
    await page.goto("/");
    await expect(page).toHaveURL(/\/bn$/);
  });
});

test.describe("Bangla formatting", () => {
  test("numbers and dates use Bangla digits in bn", async ({ page }) => {
    await page.goto("/bn");
    await expect(page.getByTestId("established")).toHaveText("প্রতিষ্ঠিত ১৯৭৫");
    const today = await page.getByTestId("today").innerText();
    expect(today).toMatch(/[০-৯]/);
    expect(today).not.toMatch(/[0-9]/);
  });

  test("numbers stay in English digits in en", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("established")).toHaveText(
      "Established 1975",
    );
  });
});

test.describe("white-label theme", () => {
  test("school name, colour and fonts come from settings", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle("Sunrise High School");
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    );
    expect(primary).toBe("#0f766e"); // seeded school_settings.primary_color
    const enFont = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(enFont).toMatch(/Inter/);

    await page.goto("/bn");
    await expect(page).toHaveTitle("সানরাইজ হাই স্কুল");
    const bnFont = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(bnFont).toMatch(/Hind Siliguri/);
  });
});
