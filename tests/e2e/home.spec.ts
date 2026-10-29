import { expect, test, type Page } from "@playwright/test";

import { adminClient } from "./helpers";

const SECTIONS = [
  "notices",
  "facts",
  "quick-links",
  "head-message",
  "at-a-glance",
  "teachers",
  "events",
  "gallery",
];

test.describe("home page", () => {
  for (const lang of ["en", "bn"] as const) {
    test(`all sections render in ${lang}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/${lang}`);
      await expect(
        page.getByRole("region", {
          name: lang === "en" ? "Photo slideshow" : "ছবির স্লাইডশো",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", {
          name: lang === "en" ? "Notice board" : "নোটিশ বোর্ড",
        }),
      ).toBeVisible();
      for (const id of SECTIONS)
        await expect(page.locator(`[data-section="${id}"]`), id).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("live counters come from the database, with Bangla digits in bn", async ({
    page,
  }) => {
    // Other tests (admissions) may add students, so read the numbers to expect.
    const { data } = await adminClient().rpc("public_stats");
    const stats = data as {
      students: number;
      by_class: { level: number; students: number }[];
    };
    const class6 = stats.by_class.find((c) => c.level === 6)!.students;
    await page.goto("/en");
    const glance = page.locator('[data-section="at-a-glance"]');
    await expect(
      glance.getByText(String(stats.students), { exact: true }),
    ).toBeVisible();
    await expect(
      glance.getByText(`Class 6: ${class6} students`),
    ).toBeAttached();
    await page.goto("/bn");
    const bnDigits = String(stats.students).replace(/[0-9]/g, (d) =>
      String.fromCharCode(0x09e6 + Number(d)),
    );
    await expect(
      page
        .locator('[data-section="at-a-glance"]')
        .getByText(bnDigits, { exact: true }),
    ).toBeVisible();
  });

  test("teacher cards show only public fields", async ({ page }) => {
    const html = await (await page.request.get("/en")).text();
    for (const secret of [
      "1990000000003",
      "1982-11-02",
      "House 9, Demo Town",
      "01910000003",
    ]) {
      expect(html).not.toContain(secret);
    }
  });

  test("slideshow can be paused and moved by hand", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Pause slideshow" }).click();
    await expect(
      page.getByRole("button", { name: "Play slideshow" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(
      page.getByRole("group", { name: "Slide 2 of 3" }),
    ).toHaveAttribute("aria-hidden", "false");
  });

  test("notice ticker can be paused", async ({ page }) => {
    await page.goto("/en");
    const ticker = page.getByRole("region", { name: "Notice board" });
    await ticker.getByRole("button", { name: "Pause" }).click();
    await expect(ticker.getByRole("button", { name: "Play" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

async function internalLinks(page: Page, selector: string) {
  return page
    .locator(`${selector} a[href^="/"]`)
    .evaluateAll((as) => [
      ...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!)),
    ]);
}

test.describe("header and footer links", () => {
  for (const lang of ["en", "bn"] as const) {
    test(`no broken links in ${lang} (crawl and assert 200)`, async ({
      page,
    }) => {
      await page.goto(`/${lang}`);
      const links = new Set([
        ...(await internalLinks(page, "header")),
        ...(await internalLinks(page, "footer")),
        ...(await internalLinks(page, '[role="region"]')),
      ]);
      // Menu links appear when a menu opens: drop-downs on desktop, the side sheet on phones.
      if ((page.viewportSize()?.width ?? 0) >= 1024) {
        for (const button of await page
          .locator("header nav button[aria-expanded]")
          .all()) {
          await button.click();
          for (const href of await internalLinks(page, "header nav"))
            links.add(href);
          await page.keyboard.press("Escape");
        }
      } else {
        await page
          .getByRole("button", { name: lang === "en" ? "Menu" : "মেনু" })
          .click();
        const sheet = page.getByRole("dialog");
        await sheet
          .locator("details")
          .evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
        for (const href of await internalLinks(page, '[role="dialog"]'))
          links.add(href);
        await page.keyboard.press("Escape");
      }
      expect(links.size).toBeGreaterThan(3);
      for (const href of links) {
        const response = await page.request.get(href);
        expect(response.status(), href).toBe(200);
      }
      const external = await page
        .locator('header a[href^="http"], footer a[href^="http"]')
        .evaluateAll((as) =>
          as.map((a) => ({
            href: a.getAttribute("href"),
            rel: a.getAttribute("rel"),
            target: a.getAttribute("target"),
          })),
        );
      for (const link of external)
        expect(link).toMatchObject({
          href: expect.stringMatching(/^https:\/\//),
          rel: "noopener noreferrer",
          target: "_blank",
        });
    });
  }

  test("menu items show only for pages that exist", async ({ page }, info) => {
    await page.goto("/en");
    // Online admission exists since Step 3.3; results since Step 4.3.
    await expect(
      page.getByRole("link", { name: "Apply Online" }).first(),
    ).toHaveAttribute("href", "/en/admission/apply");
    await expect(page.getByRole("link", { name: "History" })).toHaveCount(0);
    if (info.project.name === "desktop-chrome") {
      await page.getByRole("button", { name: "Result" }).click();
      await expect(
        page.getByRole("link", { name: "Find a result" }),
      ).toHaveAttribute("href", "/en/result");
      await expect(
        page.getByRole("link", { name: "Board exam results" }),
      ).toHaveAttribute("href", "/en/board-results");
    }
  });

  test("an unpublished page is not reachable", async ({ page }) => {
    const response = await page.goto("/en/p/history");
    expect(response?.status()).toBe(404);
  });
});

test("desktop menu: drop-down opens, closes with Escape and leads to the page", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "desktop menu");
  await page.goto("/en");
  const about = page.getByRole("button", { name: "About" });
  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(about).toHaveAttribute("aria-expanded", "false");
  await expect(about).toBeFocused();
  await about.click();
  await page.getByRole("link", { name: "About us" }).click();
  await expect(page).toHaveURL(/\/en\/p\/about-us$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About us");
});

test("phone menu: sheet opens and leads to a page in Bangla", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile-360", "phone menu");
  await page.goto("/bn");
  await page.getByRole("button", { name: "মেনু" }).click();
  const sheet = page.getByRole("dialog", { name: "প্রধান মেনু" });
  await expect(sheet).toBeVisible();
  await sheet.getByText("সুবিধাসমূহ").click();
  await sheet.getByRole("link", { name: "গ্রন্থাগার" }).click();
  await expect(page).toHaveURL(/\/bn\/p\/library$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "গ্রন্থাগার",
  );
  await expect(sheet).toHaveCount(0);
});
