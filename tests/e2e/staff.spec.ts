import { expect, test, type Page } from "@playwright/test";

import { adminClient, login, loginAs, logout } from "./helpers";

const uid = () => `${Date.now()}`.slice(-7);

async function toast(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).last()).toBeVisible();
}

/** Removes a test staff member and their login. */
async function cleanup(name: string) {
  const db = adminClient();
  const { data } = await db
    .from("staff")
    .select("id, profile_id")
    .eq("full_name_en", name);
  for (const s of data ?? []) {
    await db.from("staff").delete().eq("id", s.id);
    if (s.profile_id) await db.auth.admin.deleteUser(s.profile_id);
  }
}

test("admin adds a teacher with private details that never reach the website", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const name = `E2E Teacher ${uid()}`;
  const nid = `19${uid()}0000`.slice(0, 13);
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/staff/new");
    await page.getByLabel("Name (English)").fill(name);
    await page
      .getByLabel("Designation", { exact: true })
      .selectOption({ label: "Assistant Teacher" });
    await page.getByLabel("Subject (English)").fill("Physics");
    await page.getByLabel("NID number").fill("123");
    await page.getByLabel("Personal mobile").fill("12345");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("NID has 10, 13 or 17 digits.")).toBeVisible();
    await expect(
      page.getByText("Enter an 11-digit mobile number, e.g. 01712345678."),
    ).toBeVisible();
    await page.getByLabel("NID number").fill(nid);
    await page.getByLabel("Personal mobile").fill("০১৭১৫১২৩৪৫৬");
    await page.getByLabel("Date of birth").fill("1990-05-04");
    await page.getByLabel("Address").fill("Secret Lane 7, Demo Town");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/staff\/\d+$/);
    const id = page.url().split("/").pop();
    await toast(page, "Saved.");
    // The Bangla digits were stored as a normal mobile number.
    await expect(page.getByLabel("Personal mobile")).toHaveValue("01715123456");

    const html = await (await page.request.get(`/en/teachers/${id}`)).text();
    expect(html).toContain(name);
    for (const secret of [nid, "1990-05-04", "Secret Lane 7", "01715123456"])
      expect(html, secret).not.toContain(secret);

    await page.goto("/en/dashboard/staff");
    await page.getByLabel("Search").fill(name);
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toContainText("No login");
  } finally {
    await cleanup(name);
  }
});

test("admin creates a login with a one-time password; the teacher must change it; switching it off blocks access", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const name = `E2E Login ${uid()}`;
  const email = `e2e-staff-${uid()}@sunrise.test`;
  const db = adminClient();
  const { data: designation } = await db
    .from("designations")
    .select("id")
    .eq("name_en", "Assistant Teacher")
    .single();
  const { data: staff } = await db
    .from("staff")
    .insert({ full_name_en: name, designation_id: designation!.id })
    .select("id")
    .single();
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto(`/en/dashboard/staff/${staff!.id}`);
    // Only a super admin can give the admin role.
    await expect(
      page.getByLabel("Role").locator("option", { hasText: "Admin" }),
    ).toHaveCount(0);
    await page.getByLabel("Login email").fill("admin@sunrise.test");
    await page.getByRole("button", { name: "Create login" }).click();
    await expect(
      page.getByText("Another login already uses this email.").first(),
    ).toBeVisible();
    await page.getByLabel("Login email").fill(email);
    await page.getByRole("button", { name: "Create login" }).click();
    const password = await page.getByTestId("one-time-password").textContent();
    expect(password).toMatch(/^[A-Za-z2-9]{12}$/);
    await expect(
      page.getByText(`Logs in as ${email} (Teacher).`),
    ).toBeVisible();
    await logout(page);

    // The new teacher signs in and must choose a password first.
    await login(page, email, password!);
    await expect(page).toHaveURL(/\/en\/change-password$/);
    // Sign the new teacher out by dropping their session cookies.
    await page.context().clearCookies();

    // Switched off: the same password no longer opens the dashboard.
    await loginAs(page, "admin@sunrise.test");
    await page.goto(`/en/dashboard/staff/${staff!.id}`);
    await page.getByRole("button", { name: "Switch login off" }).click();
    await toast(page, "Done.");
    await expect(page.getByText("Switched off")).toBeVisible();
    await logout(page);
    await login(page, email, password!);
    await expect(
      page.getByText(
        "Your account has no access. Please contact the school office.",
      ),
    ).toBeVisible();
  } finally {
    await cleanup(name);
  }
});

test("teaching assignments: add, refuse a taken or untaught subject, remove", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = adminClient();
  const { data: staff } = await db
    .from("staff")
    .select("id")
    .eq("full_name_en", "Habibur Rahman")
    .single();
  const { data: before } = await db
    .from("teacher_assignments")
    .select("id")
    .eq("staff_id", staff!.id);
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto(`/en/dashboard/staff/${staff!.id}`);
    const add = async (section: string, subject: string) => {
      await page.getByRole("button", { name: "Add subject" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Section").selectOption({ label: section });
      await dialog
        .getByLabel("Subject", { exact: true })
        .selectOption({ label: subject });
      await dialog.getByRole("button", { name: "Save" }).click();
      return dialog;
    };
    // Kamal already teaches Mathematics in Class 6 A.
    const taken = await add("Class 6 A", "MATH · Mathematics");
    await expect(
      taken
        .getByText(
          "Another teacher already teaches this subject in this section.",
        )
        .first(),
    ).toBeVisible();
    await taken.getByRole("button", { name: "Cancel" }).click();
    // Class 8 subjects do not include Physics, so it is not offered.
    await page.getByRole("button", { name: "Add subject" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Section")
      .selectOption({ label: "Class 8 B" });
    await expect(
      page
        .getByRole("dialog")
        .getByLabel("Subject", { exact: true })
        .locator("option", { hasText: "PHY" }),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();

    await add("Class 8 B", "ICT · ICT");
    await toast(page, "Saved.");
    const row = page.getByRole("row", { name: /2026 Class 8 B ICT/ });
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: "Remove: ICT, Class 8 B" }).click();
    await toast(page, "Done.");
    await expect(row).toHaveCount(0);
  } finally {
    const keep = new Set((before ?? []).map((a) => a.id));
    const { data: after } = await db
      .from("teacher_assignments")
      .select("id")
      .eq("staff_id", staff!.id);
    for (const a of after ?? [])
      if (!keep.has(a.id))
        await db.from("teacher_assignments").delete().eq("id", a.id);
  }
});

test("staff list filters by designation and status, and designations are editable", async ({
  page,
}) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/bn/dashboard/staff");
  await page
    .getByLabel("অবস্থা", { exact: true })
    .selectOption({ label: "প্রাক্তন" });
  await expect(page.getByRole("status")).toHaveText("১টি সারি");
  await expect(page.getByRole("row", { name: /মোহাম্মদ আলী/ })).toBeVisible();
  await page.goto("/en/dashboard/staff/designations");
  await expect(
    page.getByRole("row", { name: /Head Teacher Teaching/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add designation" }).click();
  await page.getByRole("dialog").getByLabel("Rank").fill("1");
  await page
    .getByRole("dialog")
    .getByLabel("Name (English)")
    .fill("Duplicate rank");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("dialog").getByText("This already exists.").first(),
  ).toBeVisible();
});

test("only admins manage staff", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  for (const path of ["/en/dashboard/staff", "/en/dashboard/staff/3"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(403);
  }
});
