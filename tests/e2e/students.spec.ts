import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { adminClient, login, loginAs, logout } from "./helpers";

const PDF = path.join(process.cwd(), "public/demo/notice-sample.pdf");
const uid = () => `${Date.now()}`.slice(-7);

async function toast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).last()).toBeVisible();
}

/** Removes test students, their guardians (by mobile) and their logins. */
async function cleanup(namePrefix: string, phones: string[]) {
  const db = adminClient();
  const { data: students } = await db
    .from("students")
    .select("id, profile_id")
    .like("full_name_en", `${namePrefix}%`);
  for (const s of students ?? []) {
    await db.from("students").delete().eq("id", s.id);
    if (s.profile_id) await db.auth.admin.deleteUser(s.profile_id);
  }
  if (phones.length) {
    const { data: guardians } = await db
      .from("guardians")
      .select("id, profile_id")
      .in("phone", phones);
    for (const g of guardians ?? []) {
      await db.from("guardians").delete().eq("id", g.id);
      if (g.profile_id) await db.auth.admin.deleteUser(g.profile_id);
    }
  }
}

function csv(rows: string[][]) {
  const header =
    "name_en,name_bn,gender,birth_date,birth_reg_no,religion,blood_group,class,section,roll,guardian_name,guardian_phone,relation";
  return Buffer.from([header, ...rows.map((r) => r.join(","))].join("\n"));
}

test("import 10 students from a CSV file, then promote the class", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = uid();
  const prefix = `E2E Import ${id}`;
  const phone = `015${id}0`.slice(0, 11);
  const sessionName = `E2E-${id}`;
  const db = adminClient();
  const rows = Array.from({ length: 10 }, (_, i) => [
    `${prefix} ${i + 1}`,
    "",
    i % 2 ? "female" : "male",
    "15/03/2012",
    "",
    "islam",
    "",
    "8",
    "A",
    "",
    `${prefix} Parent`,
    phone,
    "father",
  ]);
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/students/import");
    await expect(
      page.getByRole("button", { name: "Download the template" }),
    ).toBeVisible();

    // A file with one bad row: the preview names the problem and nothing can be saved.
    await page.getByLabel("Excel or CSV file").setInputFiles({
      name: "students.csv",
      mimeType: "text/csv",
      buffer: csv([
        ...rows,
        ["", "", "x", "", "", "", "", "12", "Z", "", "", "123", ""],
      ]),
    });
    await expect(page.getByTestId("import-summary")).toContainText(
      "10 of 11 rows are ready.",
    );
    await expect(
      page.getByText("No such class and section (e.g. class 6, section A)."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import 10 students" }),
    ).toBeDisabled();

    // The fixed file imports all 10 in one go.
    await page.getByLabel("Excel or CSV file").setInputFiles({
      name: "students.csv",
      mimeType: "text/csv",
      buffer: csv(rows),
    });
    await expect(page.getByTestId("import-summary")).toContainText(
      "10 of 10 rows are ready.",
    );
    await page.getByRole("button", { name: "Import 10 students" }).click();
    await toast(page, "10 students imported.");

    await page.goto("/en/dashboard/students");
    await page.getByLabel("Search").fill(prefix);
    await expect(
      page.getByRole("row", { name: new RegExp(`${prefix} 1\\b`) }),
    ).toContainText("Class 8");
    const { count } = await db
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone);
    expect(count).toBe(1);

    // Promotion into a new session: one student is retained in Class 8.
    await db.from("academic_sessions").insert({
      name: sessionName,
      starts_on: "2090-01-01",
      ends_on: "2090-12-31",
    });
    await page.goto("/en/dashboard/students/promotion");
    await page.getByLabel("Class", { exact: true }).selectOption({
      label: "Class 8",
    });
    await page.getByRole("button", { name: "Show students" }).click();
    const retained = page.getByRole("row", {
      name: new RegExp(`${prefix} 3\\b`),
    });
    await retained.getByLabel("Retained").check();
    await page.getByLabel("Into session").selectOption({ label: sessionName });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Create enrolments" }).click();
    await toast(page, new RegExp(`students enrolled in ${sessionName}\\.`));

    const { data: next } = await db
      .from("enrollments")
      .select(
        "roll, session:academic_sessions!inner(name), student:students!inner(full_name_en), section:sections(class:classes(level))",
      )
      .eq("session.name", sessionName)
      .like("student.full_name_en", `${prefix}%`);
    const levels = (next ?? []).map(
      (e) => (e.section as unknown as { class: { level: number } }).class.level,
    );
    expect(levels.filter((l) => l === 9)).toHaveLength(9);
    expect(levels.filter((l) => l === 8)).toHaveLength(1);
  } finally {
    const { data: session } = await db
      .from("academic_sessions")
      .select("id")
      .eq("name", sessionName)
      .maybeSingle();
    if (session) {
      await db.from("enrollments").delete().eq("session_id", session.id);
      await db.from("academic_sessions").delete().eq("id", session.id);
    }
    await cleanup(prefix, [phone]);
  }
});

test("admin adds a student, links guardians, makes logins, and the student logs in with the ID", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const id = uid();
  const name = `E2E Student ${id}`;
  const phone = `016${id}0`.slice(0, 11);
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/students/new");
    await page.getByLabel("Name (English)").fill(name);
    await page.getByLabel("Gender").selectOption("female");
    await page.getByLabel("Birth registration number").fill("123");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("The birth registration number has 17 digits."),
    ).toBeVisible();
    await page.getByLabel("Birth registration number").fill("");
    await page.getByLabel("Section").selectOption({ label: "Class 7 A" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/students\/\d+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const code = (await page.getByTestId("student-code").textContent())!;
    expect(code).toMatch(/^\d{4}07\d{4}$/);
    await expect(page.getByTestId("current-enrollment")).toContainText(
      "Class 7 A, roll 1",
    );
    const profile = page.url();

    // Student login with a one-time password.
    await page.getByRole("button", { name: "Create login" }).click();
    const password = (await page
      .getByTestId("one-time-password")
      .textContent())!;
    expect(password).toMatch(/^[A-Za-z2-9]{12}$/);

    // Guardians: a new one, and an existing parent found by mobile number.
    await page.getByRole("link", { name: "Guardians" }).click();
    await page.getByLabel("Mobile", { exact: true }).fill(phone);
    await page.getByRole("button", { name: "Find" }).click();
    await expect(
      page.getByText("No guardian has this mobile yet."),
    ).toBeVisible();
    await page.getByLabel("Name (English)").fill(`${name} Mother`);
    await page.getByLabel("Relation").selectOption("mother");
    await page.getByRole("button", { name: "Add guardian" }).click();
    await toast(page, "Saved.");
    await expect(page.getByTestId("guardian")).toHaveCount(1);
    await expect(page.getByTestId("guardian").first()).toContainText(
      "Main contact",
    );

    await page.getByLabel("Mobile", { exact: true }).fill("01810000006");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByText(/Jamal Ahmed · Children: /)).toBeVisible();
    await page.getByRole("button", { name: "Add guardian" }).click();
    await expect(page.getByTestId("guardian")).toHaveCount(2);
    await expect(
      page.getByTestId("guardian").filter({ hasText: "Jamal Ahmed" }),
    ).toContainText(/Other children: (Rahim|Karim) Ahmed, (Rahim|Karim) Ahmed/);

    // Guardian login for the new mother.
    const mother = page
      .getByTestId("guardian")
      .filter({ hasText: `${name} Mother` });
    await mother.getByRole("button", { name: "Create login" }).click();
    await expect(page.getByTestId("one-time-password")).toBeVisible();

    // Documents: a private upload.
    await page.getByRole("link", { name: "Documents" }).click();
    await page.getByLabel("Name of the document").fill("Transfer certificate");
    await page
      .getByLabel("File (PDF, JPG or PNG, up to 2 MB)")
      .setInputFiles(PDF);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Transfer certificate")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View", exact: true }),
    ).toHaveCount(1);

    // ID card PDF.
    const card = await page.request.get(`${profile}/id-card`);
    expect(card.status()).toBe(200);
    expect(card.headers()["content-type"]).toBe("application/pdf");
    expect((await card.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // The student logs in with the student ID and must choose a password.
    await logout(page);
    await login(page, code, password);
    await expect(page).toHaveURL(/\/en\/change-password$/);

    // Step 6.2 (D1): switching the login off also blocks signing in to the API directly
    // (with the public key), not only the website.
    const api = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const studentLogin = { email: `student-${code}@student.invalid`, password };
    expect((await api.auth.signInWithPassword(studentLogin)).error).toBeNull();
    await page.context().clearCookies();
    await loginAs(page, "admin@sunrise.test");
    await page.goto(profile);
    await page.getByRole("button", { name: "Switch off" }).click();
    await expect(page.getByRole("button", { name: "Switch on" })).toBeVisible();
    expect(
      (await api.auth.signInWithPassword(studentLogin)).error,
    ).not.toBeNull();
    await page.getByRole("button", { name: "Switch on" }).click();
    await expect(
      page.getByRole("button", { name: "Switch off" }),
    ).toBeVisible();
    expect((await api.auth.signInWithPassword(studentLogin)).error).toBeNull();
  } finally {
    await cleanup(name, [phone]);
  }
});

test("guardians see their children and students their profile", async ({
  page,
}) => {
  await loginAs(page, "guardian@sunrise.test");
  await page.goto("/en/dashboard/my-children");
  await expect(page.getByTestId("portal-student")).toHaveCount(2);
  await expect(page.getByRole("main")).toContainText("Rahim Ahmed");
  await expect(page.getByRole("main")).toContainText("Karim Ahmed");
  await page.goto("/bn/dashboard/my-children");
  await expect(page.getByRole("main")).toContainText("রহিম আহমেদ");
  await expect(page.getByRole("main")).toContainText("২০২৬০৬০০০১");
  await page.context().clearCookies();

  await loginAs(page, "student@sunrise.test");
  await page.goto("/en/dashboard/my-profile");
  await expect(page.getByTestId("portal-student")).toContainText(
    "Student ID 2026060001",
  );
  await expect(page.getByTestId("portal-student")).toContainText(
    "Class 6, section A",
  );
  const response = await page.goto("/en/dashboard/my-children");
  expect(response?.status()).toBe(403);
});

test("teachers cannot open students or ID cards", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  const list = await page.goto("/en/dashboard/students");
  expect(list?.status()).toBe(403);
  const card = await page.request.get("/en/dashboard/students/1/id-card", {
    maxRedirects: 0,
  });
  expect(card.status()).toBe(403);
});
