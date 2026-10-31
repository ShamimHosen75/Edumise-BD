import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs, logout } from "./helpers";

const uid = () => `${Date.now()}`.slice(-5);

async function cleanup(code: string) {
  const db = adminClient();
  const { data: head } = await db
    .from("fee_heads")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!head) return;
  const { data: items } = await db
    .from("invoice_items")
    .select("invoice_id")
    .eq("fee_head_id", head.id);
  const ids = [...new Set((items ?? []).map((i) => i.invoice_id))];
  if (ids.length) await db.from("invoices").delete().in("id", ids);
  await db.from("fee_structures").delete().eq("fee_head_id", head.id);
  await db.from("fee_waivers").delete().eq("fee_head_id", head.id);
  await db.from("fee_heads").delete().eq("id", head.id);
}

async function toast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).last()).toBeVisible();
}

test("accountant sets up a fee, a waiver waits for the admin, invoices are made once", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const code = `E2E${uid()}`;
  const name = `E2E fee ${code}`;
  const db = adminClient();
  try {
    await loginAs(page, "accountant@sunrise.test");

    // 1. A one-time fee head.
    await page.goto("/en/dashboard/fees/heads");
    await page.getByRole("button", { name: "Add fee head" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Code").fill("x");
    await dialog.getByLabel("Name (English)").fill(name);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByText("Use 2–20 capital letters, digits or _ (e.g. TUITION)."),
    ).toBeVisible();
    await dialog.getByLabel("Code").fill(code.toLowerCase());
    await dialog.getByLabel("Charged").selectOption({ label: "Once" });
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("row", { name: new RegExp(name) }),
    ).toContainText(code);

    // 2. Its amount for Class 6: a bad amount cannot be saved.
    await page.goto("/en/dashboard/fees/structure");
    const cell = page.getByLabel(`${name} for Class 6`, { exact: true });
    await cell.fill("abc");
    await expect(cell).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
    await cell.fill("২৫০.৫০");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await toast(page, "Fee structure saved.");
    await expect(
      page.getByLabel(`${name} for Class 6`, { exact: true }),
    ).toHaveValue("250.50");

    // 3. A waiver entered by the accountant waits for an admin.
    await page.goto("/en/dashboard/fees/waivers");
    await page.getByRole("button", { name: "Add waiver" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Student ID").fill("2026060002");
    await dialog.getByLabel("Fee head").selectOption({ label: name });
    await dialog
      .getByLabel("Kind")
      .selectOption({ label: "Fixed amount (Tk)" });
    await dialog.getByLabel("Value").fill("50");
    await dialog.getByLabel("Reason").fill("Sibling");
    await dialog.getByRole("button", { name: "Save" }).click();
    const waiverRow = page.getByRole("row", {
      name: /Ayesha Siddika.*Sibling/,
    });
    await expect(waiverRow).toContainText("Waiting for approval");
    await expect(waiverRow).toContainText("৳50.00");

    // 4. Invoices for Class 6: preview, make, and nothing more the second time.
    await page.goto("/en/dashboard/fees/generate");
    await page.getByLabel("A one-time fee").check();
    await page.getByLabel("Fee head").selectOption({ label: name });
    for (const level of [7, 8, 9, 10])
      await page.getByLabel(`Class ${level}`, { exact: true }).uncheck();
    await page.getByRole("button", { name: "Preview" }).click();
    const preview = page.getByTestId("generate-preview");
    await expect(preview.locator("p").first()).toHaveText(
      /^\d+ invoices, total ৳[\d,]+\.\d\d \(waivers ৳0\.00\)\. 0 already billed, skipped\.$/,
    );
    // The waiver entered above waits for an admin: the preview warns (Phase 5 review C16).
    await expect(page.getByTestId("pending-waivers")).toContainText(
      "1 waivers of these students are waiting for an admin",
    );
    const count = Number((await preview.textContent())!.match(/^(\d+)/)![1]);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Make ${count} invoices` }).click();
    await toast(page, `${count} invoices made; 0 already billed.`);
    const { data: head } = await db
      .from("fee_heads")
      .select("id")
      .eq("code", code)
      .single();
    const { data: items } = await db
      .from("invoice_items")
      .select("gross, waiver")
      .eq("fee_head_id", head!.id);
    expect(items).toHaveLength(count);
    // The waiver is not approved, so nobody got it.
    expect(items!.every((i) => i.gross === 25050 && i.waiver === 0)).toBe(true);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(preview).toContainText("Nothing to bill");

    // The invoice list shows them as unpaid.
    await page.goto("/en/dashboard/fees?status=unpaid");
    await expect(page.getByTestId("invoice-list")).toContainText("৳250.50");
    await logout(page);

    // 5. An admin approves the waiver.
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/fees/waivers");
    await page
      .getByRole("button", { name: "Approve waiver for Ayesha Siddika" })
      .click();
    await toast(page, "Waiver approved.");
    await expect(
      page.getByRole("row", { name: /Ayesha Siddika.*Sibling/ }),
    ).toContainText("Approved");
  } finally {
    await cleanup(code);
  }
});

test("late-fine settings check their input and accept Bangla digits", async ({
  page,
}) => {
  const db = adminClient();
  const { data: before } = await db.from("fee_settings").select("*").single();
  try {
    await loginAs(page, "accountant@sunrise.test");
    await page.goto("/en/dashboard/fees/settings");
    await page.getByLabel("Fine per day (Tk)").fill("abc");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Enter an amount in taka, e.g. 600 or 1,200.50."),
    ).toBeVisible();
    await page.getByLabel("Fine per day (Tk)").fill("১৫");
    await page.getByLabel("Grace days").fill("3");
    await page.getByRole("button", { name: "Save" }).click();
    await toast(page, "Saved.");
    const { data: after } = await db
      .from("fee_settings")
      .select("late_fine_per_day, grace_days")
      .single();
    expect(after).toEqual({ late_fine_per_day: 1500, grace_days: 3 });
  } finally {
    await db
      .from("fee_settings")
      .update({
        late_fine_per_day: before!.late_fine_per_day,
        grace_days: before!.grace_days,
      })
      .eq("id", 1);
  }
});

test("teachers and students cannot open the fee pages", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  expect((await page.goto("/en/dashboard/fees"))?.status()).toBe(403);
  expect((await page.goto("/en/dashboard/fees/generate"))?.status()).toBe(403);
  await page.context().clearCookies();
  await loginAs(page, "student@sunrise.test");
  expect((await page.goto("/en/dashboard/fees/structure"))?.status()).toBe(403);
});
