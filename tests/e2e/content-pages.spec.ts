import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

const PAGES = [
  "/notices",
  "/notices/annual-exam-routine-2026",
  "/news",
  "/news/science-fair-winners",
  "/events?when=past",
  "/events/independence-day-2026",
  "/gallery",
  "/gallery/annual-sports-2025",
  "/downloads",
];

for (const lang of ["en", "bn"] as const) {
  test(`content pages render in ${lang} without errors or sideways scrolling`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const path of PAGES) {
      const response = await page.goto(`/${lang}${path}`);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
  });
}

test("unknown items and modules are 404, never errors", async ({ request }) => {
  for (const path of [
    "/en/notices/no-such-notice",
    "/en/downloads/999999",
    "/en/downloads/abc",
    "/bn/gallery/no-such-album",
  ])
    expect((await request.get(path)).status(), path).toBe(404);
});

test("a student cannot open content editors", async ({ page }) => {
  await loginAs(page, "student@sunrise.test");
  for (const path of ["/en/dashboard/notices", "/en/dashboard/gallery/new"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(403);
  }
  expect((await page.goto("/en/dashboard/unknown"))?.status()).toBe(404);
});

test("the event form rejects an end before the start and a bad address", async ({
  page,
}) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/events/new");
  await page
    .getByRole("tabpanel", { name: "English" })
    .getByLabel("Title", { exact: true })
    .fill("Bad event");
  await page.getByLabel("Page address").fill("Bad Address!");
  await page.getByLabel("Starts").fill("2026-12-01T10:00");
  await page.getByLabel("Ends (optional)").fill("2026-12-01T09:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("The end must be after the start."),
  ).toBeVisible();
  await expect(
    page.getByText("Use lowercase letters, numbers and dashes only"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/events\/new$/);
});
