import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

const uid = () => String(Date.now()).slice(-6);
const base = "/en/dashboard/academic";

async function toast(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).last()).toBeVisible();
}

/** Opens a row's edit dialog / delete button by the row's accessible name. */
const rowButton = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name });

test("admin sets up a session, a class, a section and its subjects", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const session = `E2E ${uid()}`;
  const section = `Z${uid().slice(-3)}`;
  await loginAs(page, "admin@sunrise.test");
  try {
    // 1. Session: create it and make it current.
    await page.goto(`${base}/sessions`);
    await page.getByRole("button", { name: "Add session" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(session);
    await dialog.getByLabel("Starts").fill("2099-01-01");
    await dialog.getByLabel("Ends").fill("2098-12-31");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByText("The end must be after the start."),
    ).toBeVisible();
    await dialog.getByLabel("Ends").fill("2099-12-31");
    await dialog.getByRole("button", { name: "Save" }).click();
    await toast(page, "Saved.");
    await expect(dialog).toHaveCount(0);
    await rowButton(page, `Make ${session} the current session`).click();
    await toast(page, `${session} is now the current session.`);
    await expect(
      page
        .getByRole("row", { name: new RegExp(session) })
        .getByText("Current", { exact: true }),
    ).toBeVisible();

    // 2. Class: Classes 6 to 10 exist, so a new class must be new; edit one instead.
    await page.goto(`${base}/classes`);
    await page.getByRole("button", { name: "Add class" }).click();
    await dialog.getByLabel("Class (6 to 10)").fill("11");
    await dialog.getByLabel("Name (English)").fill("Class 11");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByText("Class must be a number from 6 to 10."),
    ).toBeVisible();
    await dialog.getByLabel("Class (6 to 10)").fill("9");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByText("This already exists.").first(),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await rowButton(page, "Edit: Class 9").click();
    await dialog.getByLabel("Name (Bangla)").fill("নবম শ্রেণি");
    await dialog.getByRole("button", { name: "Save" }).click();
    await toast(page, "Saved.");

    // 3. Section in Class 9 with a capacity and class teacher.
    await page.goto(`${base}/sections`);
    await page.getByRole("button", { name: "Add section" }).click();
    await dialog
      .getByLabel("Class", { exact: true })
      .selectOption({ label: "Class 9" });
    await dialog.getByLabel("Name (English)").fill(section);
    await dialog.getByLabel("Capacity").fill("40");
    await dialog
      .getByLabel("Class teacher")
      .selectOption({ label: "Habibur Rahman" });
    await dialog.getByRole("button", { name: "Save" }).click();
    await toast(page, "Saved.");
    await page
      .getByLabel("Class", { exact: true })
      .selectOption({ label: "Class 9" });
    const row = page.getByRole("row", {
      name: new RegExp(`Class 9 ${section}`),
    });
    await expect(row).toContainText("Habibur Rahman");
    await expect(page.getByRole("status")).toHaveText("3 rows");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("sections.csv");

    // 4. Subjects for Class 9 Science: drop Higher Mathematics.
    await page.goto(`${base}/class-subjects`);
    await page
      .getByLabel("Class", { exact: true })
      .first()
      .selectOption({ label: "Class 9" });
    await page
      .getByLabel("Group", { exact: true })
      .first()
      .selectOption({ label: "Science" });
    await expect(page.getByText("9 subjects chosen")).toBeVisible();
    await page.getByLabel(/Higher Mathematics/).uncheck();
    await page.getByRole("button", { name: "Save subjects" }).click();
    await toast(page, "Saved.");
    await expect(
      page.getByRole("row", { name: /Class 9 Science 8/ }),
    ).not.toContainText("HMATH");
    await page.getByLabel(/Higher Mathematics/).check();
    await page.getByRole("button", { name: "Save subjects" }).click();
    await expect(
      page.getByRole("row", { name: /Class 9 Science 9/ }),
    ).toContainText("HMATH");
  } finally {
    // Put the demo data back.
    const db = adminClient();
    const { data: demo } = await db
      .from("academic_sessions")
      .select("id")
      .eq("name", "2026")
      .single();
    await db.rpc("set_current_session", { p_session_id: demo!.id });
    await db.from("academic_sessions").delete().eq("name", session);
    await db.from("sections").delete().eq("name_en", section);
    await db.from("classes").update({ name_bn: "নবম শ্রেণি" }).eq("level", 9);
  }
});

test("the current session and a used subject cannot be deleted", async ({
  page,
}) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto(`${base}/sessions`);
  page.once("dialog", (d) => d.accept());
  await rowButton(page, "Delete: 2026").click();
  await toast(page, "This is still in use, so it cannot be deleted.");
  await page.goto(`${base}/subjects`);
  page.once("dialog", (d) => d.accept());
  await rowButton(page, "Delete: Bangla").click();
  await toast(page, "This is still in use, so it cannot be deleted.");
  await expect(
    page.getByRole("cell", { name: "Bangla", exact: true }),
  ).toBeVisible();
});

test("subject search, type filter and sorting work, in Bangla too", async ({
  page,
}) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/bn/dashboard/academic/subjects");
  await page.getByLabel("খুঁজুন").fill("গণিত");
  await expect(page.getByRole("status")).toHaveText("২টি সারি");
  await page.getByLabel("খুঁজুন").fill("");
  await page
    .getByLabel("ধরন", { exact: true })
    .selectOption({ label: "চতুর্থ বিষয়" });
  await expect(page.getByRole("table").getByRole("row")).not.toHaveCount(1);
  await page.getByLabel("ধরন", { exact: true }).selectOption({ label: "সব" });
  await page.getByRole("button", { name: "কোড অনুযায়ী সাজান" }).click();
  await expect(page.getByRole("columnheader", { name: /কোড/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(page.getByRole("cell").nth(1)).toHaveText("ACC");
});

test("only admins open the academic setup", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  const response = await page.goto(`${base}/sections`);
  expect(response?.status()).toBe(403);
});
