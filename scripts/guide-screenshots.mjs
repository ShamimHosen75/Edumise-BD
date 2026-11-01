// Screenshots for docs/user-guide-en.md and docs/user-guide-bn.md (Step 6.4), taken with
// Playwright from the demo site. Run with the app served on PORT (default 3100) and the
// demo seed loaded:   node scripts/guide-screenshots.mjs
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const base = `http://localhost:${process.env.PORT ?? 3100}`;
const out = "docs/guide";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

async function session(email, lang) {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/en/login`);
  await page.getByLabel("Email or mobile number").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/dashboard/);
  return {
    page,
    shot: async (path, name) => {
      await page.goto(`${base}/${lang}${path}`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: `${out}/${name}-${lang}.png`,
        fullPage: false,
      });
    },
    close: () => ctx.close(),
  };
}

for (const lang of ["en", "bn"]) {
  // Public site
  const pub = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  const p = await pub.newPage();
  await p.goto(`${base}/${lang}`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${out}/home-${lang}.png` });
  await p.goto(`${base}/${lang}/login`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${out}/login-${lang}.png` });
  await pub.close();

  const admin = await session("admin@sunrise.test", lang);
  await admin.shot("/dashboard/admin", "admin-home");
  await admin.shot("/dashboard/settings", "admin-settings");
  await admin.shot("/dashboard/notices/new", "admin-notice");
  await admin.shot("/dashboard/admissions", "admin-admissions");
  await admin.shot("/dashboard/students", "admin-students");
  await admin.shot("/dashboard/staff", "admin-staff");
  await admin.shot("/dashboard/exams", "admin-exams");
  await admin.shot("/dashboard/routine", "admin-routine");
  await admin.shot("/dashboard/certificates", "admin-certificates");
  await admin.close();

  const teacher = await session("teacher@sunrise.test", lang);
  await teacher.shot("/dashboard/attendance", "teacher-attendance");
  await teacher.shot("/dashboard/marks", "teacher-marks");
  await teacher.shot("/dashboard/notices/new", "teacher-notice");
  await teacher.close();

  const accountant = await session("accountant@sunrise.test", lang);
  await accountant.shot("/dashboard/accountant", "accountant-home");
  await accountant.shot("/dashboard/fees/generate", "accountant-generate");
  await accountant.shot(
    "/dashboard/fees/collect?student=3",
    "accountant-collect",
  );
  await accountant.shot(
    "/dashboard/fees/reports?report=dues",
    "accountant-dues",
  );
  await accountant.close();

  const guardian = await session("guardian@sunrise.test", lang);
  await guardian.shot("/dashboard/my-children", "guardian-children");
  await guardian.shot(
    "/dashboard/my-children/1/attendance",
    "guardian-attendance",
  );
  await guardian.shot("/dashboard/my-children/1/results", "guardian-results");
  await guardian.shot("/dashboard/my-children/1/fees", "guardian-fees");
  await guardian.close();
}

await browser.close();
console.warn(`Screenshots written to ${out}/`);
