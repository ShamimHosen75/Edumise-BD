import { expect, test, type Page } from "@playwright/test";

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("/ redirects to /en", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

for (const [lang, heading] of [
  ["en", "Welcome to Edumise BD"],
  ["bn", "এডুমাইজ বিডি-তে স্বাগতম"],
] as const) {
  test(`/${lang} renders with no console errors and fits the screen`, async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const response = await page.goto(`/${lang}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("language link switches between en and bn", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "বাংলা" }).click();
  await expect(page).toHaveURL(/\/bn$/);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("unknown language returns 404", async ({ page }) => {
  const response = await page.goto("/fr");
  expect(response?.status()).toBe(404);
});
