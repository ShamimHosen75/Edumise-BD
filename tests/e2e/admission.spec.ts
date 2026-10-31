import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { cleanupApplication, login, loginAs, logout } from "./helpers";

const PHOTO = path.join(process.cwd(), "public/demo/head-teacher.jpg");
const PDF = path.join(process.cwd(), "public/demo/notice-sample.pdf");
const uid = () => `${Date.now()}`.slice(-8);
/** A made-up client address, so each test has its own rate limit. */
const fakeIp = () =>
  `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

async function fillApplication(
  page: Page,
  o: { name: string; phone: string; birthReg: string },
) {
  const next = () => page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Student name (English)").fill(o.name);
  await page.getByLabel("Date of birth").fill("2014-03-15");
  await page.getByLabel("Gender").selectOption("female");
  await page.getByLabel("Birth registration number").fill(o.birthReg);
  await page.getByLabel("Student photo").setInputFiles(PHOTO);
  await expect(page.getByText("✓ photo.jpg")).toBeVisible();
  await next();
  await page.getByLabel("Father's name").fill(`${o.name} Father`);
  await page.getByLabel("Mother's name").fill(`${o.name} Mother`);
  await page.getByLabel("Guardian's mobile").fill(o.phone);
  await page.getByLabel("Present address").fill("12 School Road, Demo Town");
  await next();
  await page
    .getByLabel("Applying for class")
    .selectOption({ label: "Class 6" });
  await page.getByLabel("Previous school").fill("Demo Primary School");
  await next();
  await page.getByLabel("Birth certificate").setInputFiles(PDF);
  await page.getByLabel("Previous transcript (optional)").setInputFiles(PDF);
  await next();
}

test("apply online, check the status, approve, and the student joins the class list", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
  const id = uid();
  const name = `E2E Applicant ${id}`;
  const phone = `017${id}`;
  const birthReg = `2014${id}12345`.slice(0, 17);
  try {
    // 1. Apply: each step checks its answers.
    await page.goto("/en/admission/apply");
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("This field is required.").first(),
    ).toBeVisible();
    await page.getByLabel("Birth registration number").fill("123");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("The birth registration number has 17 digits."),
    ).toBeVisible();
    await fillApplication(page, { name, phone, birthReg });
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
    await expect(page.getByRole("main")).toContainText(name);
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Please tick the declaration.")).toBeVisible();
    await page
      .getByLabel(/I declare that the information given is true/)
      .check();
    await page.getByRole("button", { name: "Submit application" }).click();
    const tracking = (await page.getByTestId("tracking-no").textContent())!;
    expect(tracking).toMatch(/^ADM-\d{4}-\d{5}$/);
    await expect(
      page.getByRole("heading", { name: "Application copy" }),
    ).toBeVisible();
    await expect(
      page.getByText("Some documents were not uploaded"),
    ).toHaveCount(0);

    // 2. Status: needs the tracking number and the same mobile number.
    await page.goto("/en/admission/status");
    await page.getByLabel("Tracking number").fill(tracking);
    await page.getByLabel("Mobile number").fill("01799999999");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(
      page.getByText(
        "No application matches this tracking number and mobile number.",
      ),
    ).toBeVisible();
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByTestId("admission-status")).toHaveText("Submitted");

    // 3. The office schedules a test, enters marks and approves into Class 6 B.
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/admissions");
    await page.getByLabel("Search").fill(tracking);
    await page.getByRole("link", { name }).first().click();
    await expect(page.getByRole("link", { name: "View" })).toHaveCount(2);
    await page
      .getByLabel("Status", { exact: true })
      .selectOption("test_scheduled");
    await page.getByLabel("Test date and time").fill("2026-12-05T10:00");
    await page.getByLabel("Test venue").fill("Room 101");
    await page.getByLabel("Test marks").fill("87.5");
    await page.getByRole("button", { name: "Save review" }).click();
    await expect(
      page.getByText("Saved.", { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByTestId("application-status")).toHaveText(
      "Admission test scheduled",
    );
    await page.getByLabel("Section").selectOption({ label: "Class 6 B" });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByText(
        new RegExp(`${name} is enrolled: student ID 2026\\d{6}, roll \\d+`),
      ),
    ).toBeVisible();
    const password = (await page
      .getByTestId("guardian-password")
      .textContent())!;
    expect(password).toMatch(/^[A-Za-z2-9]{12}$/);

    // 4. The student is in the class list; the merit list shows the marks.
    await page.goto("/en/dashboard/students");
    await page.getByLabel("Search").fill(name);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText(phone);
    await expect(row).toContainText("Class 6");
    await page.goto("/en/dashboard/admissions/merit");
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toContainText("87.5");
    await logout(page);

    // 5. The guardian logs in with the mobile number and must choose a password.
    await login(page, phone, password);
    await expect(page).toHaveURL(/\/en\/change-password$/);
    await page.context().clearCookies();
    await page.goto("/en/admission/status");
    await page.getByLabel("Tracking number").fill(tracking.toLowerCase());
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByTestId("admission-status")).toHaveText("Approved");
  } finally {
    // QA-03: leave nothing behind in the shared database.
    await cleanupApplication(phone);
  }
});

test("the form keeps answers on this device and works in Bangla", async ({
  page,
}) => {
  await page.goto("/bn/admission/apply");
  await page.getByLabel("শিক্ষার্থীর নাম (ইংরেজি)").fill("Draft Student");
  await page.getByLabel("জন্মনিবন্ধন নম্বর").fill("১২৩");
  await page.getByRole("button", { name: "পরবর্তী" }).click();
  await expect(page.getByText("জন্মনিবন্ধন নম্বর ১৭ সংখ্যার।")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("শিক্ষার্থীর নাম (ইংরেজি)")).toHaveValue(
    "Draft Student",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "নতুন করে শুরু করুন" }).click();
  await expect(page.getByLabel("শিক্ষার্থীর নাম (ইংরেজি)")).toHaveValue("");
});

test("visitors cannot open the admission queue; teachers get 403", async ({
  page,
}) => {
  await page.goto("/en/dashboard/admissions");
  await expect(page).toHaveURL(/\/en\/login/);
  await loginAs(page, "teacher@sunrise.test");
  const response = await page.goto("/en/dashboard/admissions");
  expect(response?.status()).toBe(403);
});
