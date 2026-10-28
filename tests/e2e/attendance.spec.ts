import { expect, test } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

const db = () => adminClient();
const dhakaToday = () =>
  new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const minusDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - n * 86_400_000)
    .toISOString()
    .slice(0, 10);

async function sectionId(level: number, name: string) {
  const { data } = await db()
    .from("sections")
    .select("id, class:classes!inner(level)")
    .eq("name_en", name)
    .eq("class.level", level)
    .single();
  return data!.id as number;
}

/** The latest school day a teacher may still mark (today or up to 3 days back). */
async function markableDay(): Promise<string | null> {
  const [{ data: settings }, { data: holidays }] = await Promise.all([
    db().from("school_settings").select("working_days").single(),
    db().from("holidays").select("starts_on, ends_on"),
  ]);
  const today = dhakaToday();
  for (let i = 0; i <= 3; i++) {
    const d = minusDays(today, i);
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    const holiday = (holidays ?? []).some(
      (h) => h.starts_on <= d && d <= h.ends_on,
    );
    if (settings!.working_days.includes(weekday) && !holiday) return d;
  }
  return null;
}

test("a teacher marks attendance on a phone and the guardian sees it", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const date = await markableDay();
  test.skip(!date, "no school day in the last 3 days");
  const s6a = await sectionId(6, "A");
  // Leave days that already had marks as they were.
  const { count: before } = await db()
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("section_id", s6a)
    .eq("date", date!);

  const phone = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const t = await phone.newPage();
  try {
    await loginAs(t, "teacher@sunrise.test");
    await t.goto(`/en/dashboard/attendance?section=${s6a}&date=${date}`);
    const students = t.getByTestId("attendance-student");
    await expect(students).toHaveCount(6);
    await t.getByRole("button", { name: "All present" }).click();
    // Rahim (roll 1): Present -> Absent. Roll 2: Present -> Absent -> Late.
    await t
      .getByRole("button", { name: /^Rahim Ahmed, roll 1: Present/ })
      .tap();
    await students.nth(1).tap();
    await students.nth(1).tap();
    await expect(t.getByTestId("attendance-counts")).toContainText(
      "Present 4 · Absent 1 · Late 1 · Leave 0",
    );
    // No sideways scrolling on a phone.
    const overflow = await t.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await t.getByRole("button", { name: "Save attendance" }).tap();
    await expect(t.getByText("Attendance saved.").last()).toBeVisible();
    await t.reload();
    await expect(
      t.getByRole("button", { name: /^Rahim Ahmed, roll 1: Absent/ }),
    ).toBeVisible();

    // The guardian (Rahim's father) sees the absence on the calendar.
    const g = await browser.newPage();
    await loginAs(g, "guardian@sunrise.test");
    await g.goto("/en/dashboard/my-children");
    await g
      .getByTestId("portal-student")
      .filter({ hasText: "Rahim Ahmed" })
      .getByRole("link", { name: "Attendance" })
      .click();
    await g.waitForURL(/\/my-children\/\d+\/attendance$/);
    await g.goto(`${g.url()}?month=${date!.slice(0, 7)}`);
    await expect(g.getByTestId("attendance-summary")).toContainText(
      /absent [1-9]/,
    );
    await g.close();
  } finally {
    if (!before)
      await db()
        .from("attendance")
        .delete()
        .eq("section_id", s6a)
        .eq("date", date!);
    await phone.close();
  }
});

test("teachers: own sections only, no changes after 3 days", async ({
  page,
}) => {
  const s9b = await sectionId(9, "B");
  await loginAs(page, "teacher@sunrise.test");
  // Class 9 B is not one of Kamal's sections: the page shows his own instead.
  await page.goto(`/en/dashboard/attendance?section=${s9b}`);
  await expect(page.getByLabel("Class and section")).not.toHaveValue(
    String(s9b),
  );
  await expect(page.getByRole("option", { name: "Class 9 B" })).toHaveCount(0);
  // An old school day is read-only for teachers.
  await page.goto("/en/dashboard/attendance?date=2026-10-18");
  await expect(
    page.getByText("This day can no longer be changed by teachers (3 days)."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save attendance" }),
  ).toHaveCount(0);
  // Future dates are refused.
  await page.goto("/en/dashboard/attendance?date=2099-01-01");
  await expect(
    page.getByText("Attendance cannot be taken for a future date."),
  ).toBeVisible();
});

test("monthly sheet with totals, Excel export, and today's widget for admins", async ({
  page,
}) => {
  const s6a = await sectionId(6, "A");
  await loginAs(page, "admin@sunrise.test");
  await expect(page.getByTestId("attendance-today")).toBeVisible();

  await page.goto(
    `/en/dashboard/attendance/sheet?section=${s6a}&month=2026-10`,
  );
  const sheet = page.getByRole("region", {
    name: "Class 6 A: attendance, October 2026",
  });
  // Mim Akter (roll 6) was absent twice in the demo week: 3 of 5 marked days.
  // Present, absent, absent, present, present -> P 3, A 2, 60 %.
  const mim = sheet.getByRole("row", { name: /Mim Akter/ });
  await expect(mim).toContainText("PAAPP");
  await expect(mim.getByRole("cell").last()).toHaveText("60");
  const file = await page.request.get(
    `/en/dashboard/attendance/sheet/export?section=${s6a}&month=2026-10`,
  );
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("spreadsheetml");
  expect([...(await file.body()).subarray(0, 2)]).toEqual([0x50, 0x4b]);

  await page.goto(
    `/bn/dashboard/attendance/sheet?section=${s6a}&month=2026-10`,
  );
  await expect(page.getByRole("heading", { level: 2 })).toContainText("হাজিরা");
});

test("students see their own attendance; others are refused", async ({
  page,
}) => {
  await loginAs(page, "student@sunrise.test");
  await page.goto("/en/dashboard/my-profile/attendance?month=2026-10");
  await expect(page.getByTestId("attendance-summary")).toContainText("Present");
  const sheet = await page.goto("/en/dashboard/attendance");
  expect(sheet?.status()).toBe(403);
  const child = await page.goto("/en/dashboard/my-children/1/attendance");
  expect(child?.status()).toBe(403);
});
