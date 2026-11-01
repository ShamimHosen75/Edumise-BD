import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { loginAs, withIds } from "./helpers";

// Step 6.3 (NFR-04): axe on every public page and the main dashboard pages. Serious and
// critical violations fail the test; moderate and minor ones are listed in the report.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

const PUBLIC = [
  "/en",
  "/bn",
  "/en/notices",
  "/en/notices/annual-exam-routine-2026",
  "/bn/notices",
  "/en/news",
  "/en/events",
  "/en/gallery",
  "/en/gallery/annual-sports-2025",
  "/en/downloads",
  "/en/teachers",
  "/en/teachers/1",
  "/en/governing-body",
  "/en/ex-principals",
  "/en/contact",
  "/bn/contact",
  "/en/admission/apply",
  "/en/admission/status",
  "/en/result",
  "/bn/result",
  "/en/board-results",
  "/en/routine",
  "/en/exam-routine",
  "/en/calendar",
  "/en/verify",
  "/en/p/about-us",
  "/en/login",
];

const DASHBOARD: Record<string, string[]> = {
  "admin@sunrise.test": [
    "/en/dashboard/admin",
    "/bn/dashboard/admin",
    "/en/dashboard/students",
    "/en/dashboard/students/1",
    "/en/dashboard/staff",
    "/en/dashboard/staff/1",
    "/en/dashboard/notices",
    "/en/dashboard/notices/new",
    "/en/dashboard/pages",
    "/en/dashboard/menu",
    "/en/dashboard/admissions",
    "/en/dashboard/academic",
    "/en/dashboard/exams",
    "/en/dashboard/exams/1",
    "/en/dashboard/routine",
    "/en/dashboard/certificates",
    "/en/dashboard/settings",
    "/en/dashboard/fees",
    "/en/dashboard/fees/collect?student=3",
    "/en/dashboard/fees/reports",
    "/en/dashboard/receipts/1",
  ],
  "teacher@sunrise.test": [
    "/en/dashboard/teacher",
    "/en/dashboard/attendance",
    "/bn/dashboard/attendance",
    "/en/dashboard/marks",
    "/en/dashboard/my-routine",
  ],
  "accountant@sunrise.test": ["/en/dashboard/accountant"],
  "guardian@sunrise.test": [
    "/en/dashboard/guardian",
    "/en/dashboard/my-children",
    "/en/dashboard/my-children/1/fees",
    "/en/dashboard/my-children/1/attendance",
  ],
  "student@sunrise.test": ["/en/dashboard/student", "/en/dashboard/my-profile"],
};

async function scan(page: Page, url: string, failures: string[]) {
  const res = await page.goto(url);
  // A missing page has almost nothing for axe to find; it must not pass by accident.
  expect(res?.status(), url).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of result.violations) {
    if (v.impact !== "serious" && v.impact !== "critical") continue;
    failures.push(
      `${url}: [${v.impact}] ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`,
    );
  }
}

test("public pages have no serious or critical accessibility violations", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "one viewport is enough");
  test.setTimeout(300_000);
  const failures: string[] = [];
  for (const url of await withIds(PUBLIC)) await scan(page, url, failures);
  expect(failures).toEqual([]);
});

test("dashboard pages have no serious or critical accessibility violations", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "one viewport is enough");
  test.setTimeout(400_000);
  const failures: string[] = [];
  for (const [user, urls] of Object.entries(DASHBOARD)) {
    await page.context().clearCookies();
    await loginAs(page, user);
    for (const url of await withIds(urls)) await scan(page, url, failures);
  }
  expect(failures).toEqual([]);
});
