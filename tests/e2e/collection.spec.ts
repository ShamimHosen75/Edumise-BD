import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs, logout } from "./helpers";

// Step 5.2: collect a part payment and the rest, receipts, the family's view, cancelling,
// the frozen late fine and the reports. Each test bills its own one-time fee head.

const KARIM = "Karim Ahmed"; // a child of guardian@sunrise.test

async function setup(opts: { gross: number; issued: string; due: string }) {
  const db = adminClient();
  const code = `E2EP${Date.now().toString().slice(-6)}`;
  const name = `E2E pay ${code}`;
  const { data: head } = await db
    .from("fee_heads")
    .insert({ code, name_en: name, frequency: "one_time", sort_order: 50 })
    .select("id")
    .single();
  const { data: st } = await db
    .from("students")
    .select("id, enrollments(session_id)")
    .eq("full_name_en", KARIM)
    .single();
  const { data: inv } = await db
    .from("invoices")
    .insert({
      invoice_no: `INV-E2E-${code}`,
      student_id: st!.id,
      session_id: st!.enrollments[0]!.session_id,
      issued_on: opts.issued,
      due_on: opts.due,
      total: opts.gross,
    })
    .select("id")
    .single();
  await db.from("invoice_items").insert({
    invoice_id: inv!.id,
    student_id: st!.id,
    fee_head_id: head!.id,
    period_key: `session:${st!.enrollments[0]!.session_id}`,
    gross: opts.gross,
  });
  return { db, headId: head!.id, invoiceId: inv!.id, studentId: st!.id, name };
}

async function cleanup(s: Awaited<ReturnType<typeof setup>>) {
  const { db } = s;
  const { data: items } = await db
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", s.invoiceId);
  const ids = (items ?? []).map((i) => i.id);
  const { data: allocs } = await db
    .from("payment_allocations")
    .select("payment_id")
    .in("invoice_item_id", ids);
  const payments = [...new Set((allocs ?? []).map((a) => a.payment_id))];
  await db.from("payment_allocations").delete().in("invoice_item_id", ids);
  if (payments.length) await db.from("payments").delete().in("id", payments);
  await db.from("invoices").delete().eq("id", s.invoiceId);
  await db.from("fee_heads").delete().eq("id", s.headId);
}

/** Opens Karim on the collect screen and ticks only this test's items. */
async function openKarim(page: Page, headName: string) {
  await page.goto("/en/dashboard/fees/collect");
  await page.getByLabel("Find a student").fill("Karim");
  await page.getByRole("button", { name: "Find" }).click();
  await page.getByTestId("found-students").getByText(KARIM).click();
  await expect(page.getByTestId("due-items")).toContainText(headName);
  for (const box of await page
    .getByTestId("due-items")
    .getByRole("checkbox")
    .all()) {
    const label = (await box.getAttribute("aria-label")) ?? "";
    if ((await box.isEnabled()) && !label.includes(headName))
      await box.uncheck();
  }
}

async function invoice(s: Awaited<ReturnType<typeof setup>>) {
  const { data } = await s.db
    .from("invoices")
    .select("total, paid, status")
    .eq("id", s.invoiceId)
    .single();
  return data!;
}

test("collect part and the rest, the guardian sees the receipts, an admin cancels one", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const s = await setup({
    gross: 100000,
    issued: "2026-10-01",
    due: "2099-12-31",
  });
  try {
    await loginAs(page, "accountant@sunrise.test");
    await openKarim(page, s.name);
    const amount = page.getByLabel("Amount received (Tk)");
    await expect(amount).toHaveValue("1000");

    // More than owed is refused before saving.
    await amount.fill("1000.01");
    await expect(
      page.getByText("This is more than the ticked items owe."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save and print receipt" }),
    ).toBeDisabled();

    // bKash needs its transaction ID.
    await amount.fill("৪০০");
    await page.getByLabel("Paid by").selectOption("bkash");
    await expect(page.getByTestId("allocation-preview")).toContainText(
      "৳400.00",
    );
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Save and print receipt" }).click();
    await expect(
      page.getByText("Enter the transaction ID for mobile banking."),
    ).toBeVisible();
    const txn = `E2E${Date.now()}`;
    await page.getByLabel("Transaction ID").fill(txn.toLowerCase());
    await page.getByRole("button", { name: "Save and print receipt" }).click();

    await expect(page).toHaveURL(/\/en\/dashboard\/receipts\/\d+$/);
    const receipt = page.getByTestId("receipt");
    await expect(receipt).toContainText(/RCP-\d{4}-\d{6}/);
    await expect(receipt).toContainText(txn);
    await expect(page.getByTestId("receipt-total")).toHaveText("৳400.00");
    await expect(page.getByTestId("receipt-due")).toHaveText("৳600.00");
    await expect(page.getByTestId("receipt-words")).toContainText(
      "Four hundred taka only",
    );
    await expect(page.getByTestId("receipt-words")).toContainText(
      "চার শত টাকা মাত্র",
    );
    expect(await invoice(s)).toEqual({
      total: 100000,
      paid: 40000,
      status: "partial",
    });
    const firstUrl = page.url();

    // The PDF downloads.
    const pdf = await page.request.get(`${firstUrl}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // The same bKash transaction cannot be recorded again; the rest in cash.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByTestId("due-items")).toContainText(s.name);
    for (const box of await page
      .getByTestId("due-items")
      .getByRole("checkbox")
      .all()) {
      const label = (await box.getAttribute("aria-label")) ?? "";
      if ((await box.isEnabled()) && !label.includes(s.name))
        await box.uncheck();
    }
    await expect(amount).toHaveValue("600");
    await page.getByLabel("Paid by").selectOption("bkash");
    await page.getByLabel("Transaction ID").fill(txn);
    await page.getByRole("button", { name: "Save and print receipt" }).click();
    await expect(
      page.getByText("This transaction ID is already recorded."),
    ).toBeVisible();
    await page.getByLabel("Paid by").selectOption("cash");
    await page.getByLabel("Transaction or slip no. (optional)").fill("");
    await page.getByRole("button", { name: "Save and print receipt" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/receipts\/\d+$/);
    await expect(page.getByTestId("receipt-total")).toHaveText("৳600.00");
    const secondUrl = page.url();
    expect(await invoice(s)).toEqual({
      total: 100000,
      paid: 100000,
      status: "paid",
    });

    // Daily report and its Excel file; the accountant cannot cancel.
    await expect(
      page.getByRole("button", { name: "Cancel payment" }),
    ).toHaveCount(0);
    await page.goto("/en/dashboard/fees/reports?report=daily");
    await expect(page.getByTestId("report")).toContainText(txn);
    const xlsx = await page.request.get(
      "/en/dashboard/fees/reports/export?report=daily&format=xlsx",
    );
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    await page.goto("/en/dashboard/fees/reports?report=ledger");
    await expect(
      page.getByText("Enter a student ID to see the ledger."),
    ).toBeVisible();
    await logout(page);

    // The guardian sees both receipts and opens one.
    await loginAs(page, "guardian@sunrise.test");
    await page.goto(`/en/dashboard/my-children/${s.studentId}/fees`);
    const receipts = page.getByTestId("portal-receipts");
    await expect(receipts.getByRole("link")).toHaveCount(2);
    await page.goto(firstUrl);
    await expect(page.getByTestId("receipt-total")).toHaveText("৳400.00");
    await expect(
      page.getByRole("button", { name: "Cancel payment" }),
    ).toHaveCount(0);
    await logout(page);

    // An admin cancels the cash payment: the invoice owes it again.
    await loginAs(page, "admin@sunrise.test");
    await page.goto(secondUrl);
    await page.getByRole("button", { name: "Cancel payment" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("Wrong student");
    await dialog.getByRole("button", { name: "Cancel payment" }).click();
    await expect(page.getByTestId("receipt")).toContainText("CANCELLED");
    await expect(page.getByTestId("receipt")).toContainText("Wrong student");
    expect(await invoice(s)).toEqual({
      total: 100000,
      paid: 40000,
      status: "partial",
    });
  } finally {
    await cleanup(s);
  }
});

test("a late fine is frozen onto the invoice at the first payment", async ({
  page,
}) => {
  const s = await setup({
    gross: 50000,
    issued: "2026-09-01",
    due: "2026-09-05",
  });
  try {
    const { data: rule } = await s.db.from("fee_settings").select("*").single();
    test.skip(!rule!.late_fine_per_day, "no late fine set");
    page.on("dialog", (d) => d.accept());
    await loginAs(page, "accountant@sunrise.test");
    await openKarim(page, s.name);
    const fineRow = page
      .getByTestId("due-items")
      .getByRole("row", { name: /Late fine today/ });
    await expect(fineRow).toBeVisible();
    // The fine comes with its invoice and cannot be unticked alone.
    await expect(fineRow.getByRole("checkbox")).toBeChecked();
    await expect(fineRow.getByRole("checkbox")).toBeDisabled();
    await page.getByRole("button", { name: "Save and print receipt" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/receipts\/\d+$/);
    await expect(page.getByTestId("receipt")).toContainText("Late fine");
    const inv = await invoice(s);
    expect(inv.status).toBe("paid");
    expect(inv.total).toBeGreaterThan(50000);
  } finally {
    await cleanup(s);
  }
});

test("families see their fees; teachers see no fees or receipts", async ({
  page,
}) => {
  await loginAs(page, "student@sunrise.test");
  await page.goto("/en/dashboard/my-profile/fees");
  await expect(page.getByTestId("fees-due")).toBeVisible();
  await expect(page.getByTestId("portal-receipts")).toContainText(
    "RCP-2026-000001",
  );
  await page.goto("/bn/dashboard/my-profile/fees");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ফি");
  await page.context().clearCookies();
  await loginAs(page, "teacher@sunrise.test");
  expect((await page.goto("/en/dashboard/fees/collect"))?.status()).toBe(403);
  expect((await page.goto("/en/dashboard/fees/reports"))?.status()).toBe(403);
  expect((await page.goto("/en/dashboard/receipts/1"))?.status()).toBe(403);
});

test("the accountant's home shows the collection", async ({ page }) => {
  await loginAs(page, "accountant@sunrise.test");
  await expect(page.getByTestId("collection-widgets")).toBeVisible();
  await expect(page.getByTestId("widget-today")).toHaveText(/^৳[\d,]+\.\d\d$/);
});
