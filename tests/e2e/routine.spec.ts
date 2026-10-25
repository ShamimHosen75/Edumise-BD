import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

async function sectionId(level: number, name: string) {
  const { data } = await adminClient()
    .from("sections")
    .select("id, class:classes!inner(level)")
    .eq("name_en", name)
    .eq("class.level", level)
    .single();
  return data!.id as number;
}

async function pick(page: Page, slot: RegExp) {
  await page.getByRole("button", { name: slot }).click();
  await expect(page.getByTestId("cell-editor")).toBeVisible();
}

test("admin builds a section routine; clashes block saving; teacher and public views show it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const s6b = await sectionId(6, "B");
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto(`/en/dashboard/routine?section=${s6b}`);
    await expect(
      page.getByRole("heading", { name: "Class 6 B: class routine (2026)" }),
    ).toBeVisible();

    // Kamal Hossain and Room 101 already have Class 6 A on Sunday, period 1.
    await pick(page, /^Sunday, period 1:/);
    await page.getByLabel("Subject").selectOption({ label: "Mathematics" });
    await page.getByLabel("Teacher").selectOption({ label: "Kamal Hossain" });
    await page.getByLabel("Room").selectOption({ label: "Room 101" });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.getByText("Teacher already in Class 6 A at this time."),
    ).toBeVisible();
    await expect(
      page.getByText("Room already used by Class 6 A at this time."),
    ).toBeVisible();
    await expect(page.getByText(/^Clashes: 2\./)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save routine" }),
    ).toBeDisabled();

    // Another teacher and room: no clash, and it saves.
    await pick(page, /^Sunday, period 1:/);
    await page.getByLabel("Teacher").selectOption({ label: "Shirin Sultana" });
    await page.getByLabel("Room").selectOption({ label: "Room 102" });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/^Clashes:/)).toHaveCount(0);
    await pick(page, /^Monday, period 2:/);
    await page.getByLabel("Subject").selectOption({ label: "English" });
    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("button", { name: "Save routine" }).click();
    await expect(page.getByText("Routine saved.").last()).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Sunday, period 1: Mathematics" }),
    ).toContainText("Shirin Sultana");

    // By teacher.
    await page.getByRole("link", { name: "By teacher" }).click();
    await page.getByLabel("Teacher").selectOption({ label: "Shirin Sultana" });
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByRole("table")).toContainText("Class 6 B");

    // The public page shows the new routine.
    await page.goto(`/en/routine?section=${s6b}`);
    const table = page.getByRole("table");
    await expect(table).toContainText("Mathematics");
    await expect(table).toContainText("Room 102");
    await expect(table).toContainText("English");
  } finally {
    const db = adminClient();
    await db.from("routine").delete().eq("section_id", s6b);
  }
});

test("teachers see their own routine and cannot edit routines", async ({
  page,
}) => {
  await loginAs(page, "teacher@sunrise.test");
  await page.goto("/en/dashboard/my-routine");
  await expect(
    page.getByRole("heading", { name: "Kamal Hossain: routine (2026)" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Class 6 A");
  await page.goto("/bn/dashboard/my-routine");
  await expect(page.getByRole("table")).toContainText("রবিবার");
  for (const path of ["/en/dashboard/routine", "/en/dashboard/exam-schedule"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(403);
  }
});

test("exam schedule: add a paper, hide and publish the schedule on the website", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/exam-schedule");
  await page.getByLabel("Exam").selectOption({ label: "Annual Exam 2026" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByTestId("schedule-status")).toHaveText(
    "Published on the website",
  );

  await page.getByRole("button", { name: "Add paper" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Class").selectOption({ label: "Class 9" });
  await dialog.getByLabel("Subject").selectOption({ label: "Physics" });
  await dialog.getByLabel("Date").fill("2026-11-28");
  await dialog.getByLabel("Starts").fill("14:00");
  await dialog.getByLabel("Ends").fill("13:00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    dialog.getByText("The end must be after the start."),
  ).toBeVisible();
  await dialog.getByLabel("Ends").fill("16:00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /Physics/ })).toContainText(
    "14:00–16:00",
  );

  try {
    await page.goto("/en/exam-routine");
    await expect(page.getByRole("main")).toContainText("Annual Exam 2026");
    await expect(page.getByRole("main")).toContainText("Physics");

    // Hidden: visitors no longer see it.
    await page.goto("/en/dashboard/exam-schedule");
    await page.getByLabel("Exam").selectOption({ label: "Annual Exam 2026" });
    await page.getByRole("button", { name: "Show" }).click();
    await page.getByRole("button", { name: "Hide the schedule" }).click();
    await expect(page.getByTestId("schedule-status")).toHaveText(
      "Not published yet",
    );
    await page.goto("/en/exam-routine");
    await expect(page.getByRole("main")).not.toContainText("Annual Exam 2026");
  } finally {
    await page.goto("/en/dashboard/exam-schedule");
    await page.getByLabel("Exam").selectOption({ label: "Annual Exam 2026" });
    await page.getByRole("button", { name: "Show" }).click();
    const publish = page.getByRole("button", { name: "Publish the schedule" });
    if (await publish.isVisible()) {
      await publish.click();
      await expect(page.getByTestId("schedule-status")).toHaveText(
        "Published on the website",
      );
    }
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Delete: Class 9: Physics" })
      .click();
    await expect(page.getByRole("row", { name: /Physics/ })).toHaveCount(0);
  }
});

test("calendar: holidays and events by month; a new holiday appears", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/en/calendar?month=2026-12");
  await expect(page.getByTestId("calendar-month")).toHaveText("December 2026");
  await expect(page.getByTestId("calendar-items")).toContainText("Victory Day");
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByTestId("calendar-month")).toHaveText("January 2027");
  await page.goto("/bn/calendar?month=2026-12");
  await expect(page.getByTestId("calendar-items")).toContainText("বিজয় দিবস");

  const title = `E2E Holiday ${Date.now()}`.slice(0, 30);
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/academic/holidays");
  await page.getByRole("button", { name: "Add holiday" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title (English)").fill(title);
  await dialog.getByLabel("From").fill("2027-01-10");
  await dialog.getByLabel("To").fill("2027-01-11");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(title) }),
  ).toBeVisible();
  try {
    await page.goto("/en/calendar?month=2027-01");
    await expect(page.getByTestId("calendar-items")).toContainText(title);
  } finally {
    await page.goto("/en/dashboard/academic/holidays");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Delete: ${title}` }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(title) }),
    ).toHaveCount(0);
  }
});

test("periods: end before start is refused; working days are saved", async ({
  page,
}) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/academic/periods");
  await page.getByRole("button", { name: "Add period" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Starts").fill("14:00");
  await dialog.getByLabel("Ends").fill("13:00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    dialog.getByText("The end must be after the start."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Save working days" }).click();
  await expect(page.getByText("Saved.").last()).toBeVisible();
  await expect(page.getByLabel("Saturday")).toBeChecked();
  await expect(page.getByLabel("Friday")).not.toBeChecked();
});
