import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

// Step 6.1: tests for requirements that had none (docs/traceability.md).

const uid = () => `${Date.now()}${Math.round(Math.random() * 1e4)}`;

async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("main").getByRole("status").filter({ hasText: "Saved." }),
  ).toBeVisible();
}

test("news: a draft stays hidden; published news shows in the list and in Bangla (WEB-07/08/14)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const n = uid();
  const title = `E2E news ${n}`;
  const titleBn = `ই২ই সংবাদ ${n}`;
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/news/new");
  await page
    .getByRole("tabpanel", { name: "English" })
    .getByLabel("Title", { exact: true })
    .fill(title);
  await page.getByRole("tab", { name: "Bangla" }).click();
  await page
    .getByRole("tabpanel", { name: "Bangla" })
    .getByLabel("Title", { exact: true })
    .fill(titleBn);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/news\/\d+$/);
  const id = page.url().split("/").pop()!;
  const slug = await page.getByLabel("Page address").inputValue();
  try {
    expect((await page.request.get(`/en/news/${slug}`)).status()).toBe(404);
    await page.getByLabel("Published", { exact: true }).check();
    await save(page);
    await page.goto(`/en/news?q=${encodeURIComponent(title)}`);
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.goto(`/bn/news/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(titleBn);
  } finally {
    await adminClient().from("news").delete().eq("id", Number(id));
  }
});

test.describe("fee reports (FEE-04, FEE-06)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "accountant@sunrise.test");
  });

  test("dues by class show who owes what, with the guardian's phone and today's late fine", async ({
    page,
  }) => {
    await page.goto("/en/dashboard/fees/reports?report=dues");
    const report = page.getByTestId("report");
    // Seed: Ayesha owes Tk 400, Tanvir Tk 600; both bills are overdue (+ Tk 100 late fine).
    await expect(
      report.getByRole("row", { name: /Ayesha Siddika/ }),
    ).toContainText("৳500.00");
    await expect(
      report.getByRole("row", { name: /Tanvir Hasan/ }),
    ).toContainText("৳700.00");
    await expect(
      report.getByRole("row", { name: /Tanvir Hasan/ }),
    ).toContainText(/01\d{9}/);
    // Rahim has paid: not listed.
    await expect(report.getByRole("row", { name: /Rahim Ahmed/ })).toHaveCount(
      0,
    );
    // Filtered by a month in Bangla digits.
    await page.goto("/en/dashboard/fees/reports?report=dues&period=২০২৬-১০");
    await expect(report).toContainText("October 2026");
  });

  test("income by fee for a date range, and the student ledger", async ({
    page,
  }) => {
    // Swapped dates are put the right way round.
    await page.goto(
      "/en/dashboard/fees/reports?report=income&from=2026-10-31&to=2026-10-01",
    );
    const report = page.getByTestId("report");
    await expect(
      report.getByRole("row", { name: /Monthly tuition/ }),
    ).toContainText("৳500.00");

    await page.goto("/en/dashboard/fees/reports?report=ledger&code=2026060002");
    await expect(report).toContainText("Ayesha Siddika");
    await expect(
      report.getByRole("row", { name: /RCP-2026-000002/ }),
    ).toContainText("৳200.00");
    await expect(report.locator("tfoot")).toContainText("৳400.00");

    await page.goto("/en/dashboard/fees/reports?report=ledger&code=1111111111");
    await expect(page.getByText("No student with this ID.")).toBeVisible();
  });

  test("reports download as Excel and PDF; teachers cannot download them", async ({
    page,
    browser,
  }) => {
    for (const report of ["dues", "income", "daily"]) {
      const xlsx = await page.request.get(
        `/en/dashboard/fees/reports/export?report=${report}&format=xlsx`,
      );
      expect(xlsx.status(), report).toBe(200);
      expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
      const pdf = await page.request.get(
        `/en/dashboard/fees/reports/export?report=${report}&format=pdf`,
      );
      expect(pdf.status(), report).toBe(200);
      expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    }
    const teacher = await browser.newPage();
    await loginAs(teacher, "teacher@sunrise.test");
    const r = await teacher.request.get(
      "/en/dashboard/fees/reports/export?report=dues&format=xlsx",
    );
    expect(r.status()).toBe(403);
    await teacher.close();
  });
});
