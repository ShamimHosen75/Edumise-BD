import { expect, test, type Page } from "@playwright/test";

import { loginAs, withIds } from "./helpers";

// Step 6.3 (NFR-06): every dashboard screen fits a 360px phone without sideways
// scrolling (tables scroll inside their own box), and the printable pages hide the
// chrome and use their page rules.

const SCREENS: Record<string, string[]> = {
  "admin@sunrise.test": [
    "/en/dashboard/admin",
    "/en/dashboard/students",
    "/en/dashboard/students/1",
    "/en/dashboard/students/new",
    "/en/dashboard/students/import",
    "/en/dashboard/students/promotion",
    "/en/dashboard/staff",
    "/en/dashboard/staff/1",
    "/en/dashboard/staff/new",
    "/en/dashboard/staff/designations",
    "/en/dashboard/admissions",
    "/en/dashboard/admissions/1",
    "/en/dashboard/admissions/merit",
    "/en/dashboard/academic",
    "/en/dashboard/academic/sections",
    "/en/dashboard/academic/subjects",
    "/en/dashboard/exams",
    "/en/dashboard/exams/1",
    "/en/dashboard/exams/1/tabulation",
    "/en/dashboard/exam-schedule",
    "/en/dashboard/routine",
    "/en/dashboard/routine/teacher",
    "/en/dashboard/attendance",
    "/en/dashboard/attendance/sheet",
    "/en/dashboard/board-results",
    "/en/dashboard/certificates",
    "/en/dashboard/certificates/new",
    "/en/dashboard/certificates/1",
    "/en/dashboard/notices",
    "/en/dashboard/notices/new",
    "/en/dashboard/notices/1",
    "/en/dashboard/news",
    "/en/dashboard/events",
    "/en/dashboard/gallery",
    "/en/dashboard/gallery/1",
    "/en/dashboard/downloads",
    "/en/dashboard/pages",
    "/en/dashboard/pages/1",
    "/en/dashboard/menu",
    "/en/dashboard/messages",
    "/en/dashboard/governing-body",
    "/en/dashboard/ex-principals",
    "/en/dashboard/settings",
    "/en/dashboard/fees",
    "/en/dashboard/fees/collect?student=3",
    "/en/dashboard/fees/generate",
    "/en/dashboard/fees/heads",
    "/en/dashboard/fees/structure",
    "/en/dashboard/fees/waivers",
    "/en/dashboard/fees/settings",
    "/en/dashboard/fees/reports?report=dues",
    "/en/dashboard/fees/reports?report=daily&day=2026-10-10",
    "/en/dashboard/fees/invoices/1",
    "/en/dashboard/receipts/1",
    "/bn/dashboard/fees/collect?student=3",
    "/bn/dashboard/students",
  ],
  "teacher@sunrise.test": [
    "/en/dashboard/teacher",
    "/en/dashboard/attendance",
    "/en/dashboard/marks",
    "/en/dashboard/my-routine",
  ],
  "accountant@sunrise.test": ["/en/dashboard/accountant"],
  "guardian@sunrise.test": [
    "/en/dashboard/guardian",
    "/en/dashboard/my-children",
    "/en/dashboard/my-children/1/fees",
    "/en/dashboard/my-children/1/attendance",
    "/en/dashboard/my-children/1/results",
  ],
  "student@sunrise.test": [
    "/en/dashboard/student",
    "/en/dashboard/my-profile",
    "/en/dashboard/my-profile/fees",
  ],
};

/** The page's scroll width beyond the viewport, plus any element wider than it. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= w + 1) return false;
        // Inside a box that scrolls on its own (tables): fine.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden") return false;
        }
        return getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`,
      );
    return { extra: document.documentElement.scrollWidth - w, wide };
  });
}

/** Real ids for the detail pages (tests delete and recreate rows, so ids move). */
test("every dashboard screen fits a 360px phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-360", "phone layout only");
  test.setTimeout(600_000);
  const problems: string[] = [];
  for (const [user, list] of Object.entries(SCREENS)) {
    const urls = await withIds(list);
    await page.context().clearCookies();
    await loginAs(page, user);
    for (const url of urls) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      const o = await overflow(page);
      if (o.extra > 0 || o.wide.length)
        problems.push(`${url}: +${o.extra}px ${o.wide.join(", ")}`);
    }
  }
  expect(problems).toEqual([]);
});

const PRINTABLE = [
  { url: "/en/dashboard/receipts/1", sheet: true },
  { url: "/en/dashboard/exams/1/results/1", sheet: true },
  { url: "/en/dashboard/attendance/sheet", sheet: false },
  { url: "/en/dashboard/routine", sheet: false },
  { url: "/en/routine", sheet: false },
];

test("printable pages hide the navigation and keep their content when printed", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "print layout");
  await loginAs(page, "admin@sunrise.test");
  for (const { url, sheet } of PRINTABLE) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ media: "print" });
    const hidden = await page
      .locator("nav, .print\\:hidden")
      // A box inside a hidden parent has no client rects (its own display stays).
      .evaluateAll((els) =>
        els.every((el) => el.getClientRects().length === 0),
      );
    expect(hidden, `${url}: navigation hidden when printing`).toBe(true);
    const main = page.getByRole("main");
    await expect(main, url).toBeVisible();
    if (sheet) await expect(page.locator(".print-sheet").first()).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  }
});
