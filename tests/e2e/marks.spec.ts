import { expect, test, type Page } from "@playwright/test";

import { toXlsx } from "../../src/lib/xlsx";

import { adminClient, loginAs, logout } from "./helpers";

const uid = () => `${Date.now()}`.slice(-6);

async function openExam(page: Page, name: string) {
  await page.goto("/en/dashboard/exams");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function marksFor(page: Page, exam: string, entry: string) {
  await page.goto("/en/dashboard/marks");
  await page.getByLabel("Exam").selectOption({ label: exam });
  await page.getByRole("button", { name: "Show" }).click();
  await page.getByLabel("Class and subject").selectOption({ label: entry });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: `${exam} · ${entry}` }),
  ).toBeVisible();
}

test("admin sets up an exam; a teacher enters, imports and locks marks; admin unlocks", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const exam = `E2E Exam ${uid()}`;
  try {
    // 1. The office creates the exam for Class 6, adds the subjects, opens marks entry.
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/exams");
    await page.getByRole("button", { name: "Add exam" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name (English)").fill(exam);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Choose at least one class.")).toBeVisible();
    await dialog.getByLabel("Class 6").check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("link", { name: exam, exact: true }),
    ).toBeVisible();
    await openExam(page, exam);
    await page.getByRole("button", { name: "Add Class 6's subjects" }).click();
    await expect(page.getByText("6 subjects added.").last()).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Move to: Marks entry" }).click();
    await expect(page.getByTestId("exam-status")).toHaveText("Marks entry");
    await logout(page);

    // 2. The maths teacher enters marks for 6A; a mark above full is refused.
    await loginAs(page, "teacher@sunrise.test");
    await marksFor(page, exam, "Class 6 A · Mathematics");
    const cq = (name: string) => page.getByLabel(`CQ for ${name} (out of 70)`);
    const mcq = (name: string) =>
      page.getByLabel(`MCQ for ${name} (out of 30)`);
    await cq("Rahim Ahmed").fill("75");
    await expect(cq("Rahim Ahmed")).toHaveAttribute("aria-invalid", "true");
    await cq("Rahim Ahmed").fill("65");
    await mcq("Rahim Ahmed").fill("২৮");
    for (const name of [
      "Ayesha Siddika",
      "Tanvir Hasan",
      "Nusrat Jahan",
      "Sakib Al Mamun",
    ]) {
      await cq(name).fill("50");
      await mcq(name).fill("20");
    }
    await page.getByLabel("Mim Akter absent").check();
    await expect(page.getByTestId("marks-progress")).toContainText(
      "6 of 6 entered",
    );
    await expect(page.getByText("All changes saved.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("marks-total").first()).toHaveText("93");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Submit & lock" }).click();
    await expect(page.getByText("Submitted and locked.").last()).toBeVisible();
    await expect(page.getByText(/^Submitted on /)).toBeVisible();
    await expect(cq("Rahim Ahmed")).toBeDisabled();
    await expect(cq("Rahim Ahmed")).toHaveValue("65");

    // 3. 6B is still open: marks come from an Excel file.
    await marksFor(page, exam, "Class 6 B · Mathematics");
    const file = toXlsx("Marks", [
      ["roll", "name", "cq", "mcq", "practical", "absent"],
      [1, "Arif", 60, 25, null, null],
      [2, "Sumaiya", 55, 22, null, null],
      [3, "Fahim", null, null, null, "yes"],
      [4, "Lamia", 70, 30, null, null],
    ]);
    await page.getByLabel("Excel or CSV file").setInputFiles({
      name: "marks.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(file),
    });
    await expect(page.getByTestId("marks-import-preview")).toContainText(
      "Ready",
    );
    await page.getByRole("button", { name: "Use 4 rows" }).click();
    await expect(
      page.getByText("4 rows imported and saved.").last(),
    ).toBeVisible();
    // Other tests may have added a student to 6B (admission): at least the 4 imported.
    await expect(page.getByTestId("marks-progress")).toContainText(
      /^4 of \d+ entered/,
    );
    await expect(
      page.getByLabel("CQ for Lamia Rahman (out of 70)"),
    ).toHaveValue("70");
    await logout(page);

    // 4. The office sees the progress and unlocks 6A.
    await loginAs(page, "admin@sunrise.test");
    await openExam(page, exam);
    await page.getByRole("link", { name: "Marks completion" }).click();
    const row = page.getByRole("row", { name: /Class 6 A Mathematics/ });
    await expect(row).toContainText("6 / 6");
    await expect(row).toContainText("Submitted");
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("Unlocked.").last()).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Class 6 A Mathematics/ }),
    ).toContainText("Open");
  } finally {
    await adminClient().from("exams").delete().eq("name_en", exam);
  }
});

test("teachers cannot open exam setup or enter another teacher's subject", async ({
  page,
}) => {
  await loginAs(page, "teacher@sunrise.test");
  const response = await page.goto("/en/dashboard/exams");
  expect(response?.status()).toBe(403);
  await page.goto("/en/dashboard/marks");
  // Kamal teaches Mathematics only: no other subject is offered.
  const options = page.getByLabel("Class and subject").locator("option");
  if (await options.count())
    for (const text of await options.allTextContents())
      expect(text).toContain("Mathematics");
});
