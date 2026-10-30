import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

import { adminClient, loginAs, logout } from "./helpers";

// Step 5.3: online payment with the sandbox gateway. The admin switches it on, a
// guardian pays from the fee page, and the webhook records the payment once.

const KARIM = "Karim Ahmed"; // a child of guardian@sunrise.test

async function setup() {
  const db = adminClient();
  const code = `E2EO${Date.now().toString().slice(-6)}`;
  const { data: head } = await db
    .from("fee_heads")
    .insert({
      code,
      name_en: `E2E online ${code}`,
      frequency: "one_time",
      sort_order: 51,
    })
    .select("id")
    .single();
  const { data: st } = await db
    .from("students")
    .select("id, enrollments(session_id)")
    .eq("full_name_en", KARIM)
    .single();
  const session = st!.enrollments[0]!.session_id;
  const today = new Date().toISOString().slice(0, 10);
  const { data: inv } = await db
    .from("invoices")
    .insert({
      invoice_no: `INV-E2E-${code}`,
      student_id: st!.id,
      session_id: session,
      issued_on: today,
      due_on: "2099-12-31",
      total: 50000,
    })
    .select("id")
    .single();
  await db.from("invoice_items").insert({
    invoice_id: inv!.id,
    student_id: st!.id,
    fee_head_id: head!.id,
    period_key: `session:${session}`,
    gross: 50000,
  });
  const { data: before } = await db
    .from("fee_settings")
    .select("online_payment_enabled, payment_provider")
    .single();
  return {
    db,
    headId: head!.id,
    invoiceId: inv!.id,
    studentId: st!.id,
    before: before!,
  };
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
  await db.from("payment_intents").delete().eq("student_id", s.studentId);
  await db.from("payment_allocations").delete().in("invoice_item_id", ids);
  if (payments.length) await db.from("payments").delete().in("id", payments);
  await db.from("invoices").delete().eq("id", s.invoiceId);
  await db.from("fee_heads").delete().eq("id", s.headId);
  await db.from("fee_settings").update(s.before).eq("id", 1);
}

type Event = {
  intentId: string;
  providerTxnId: string;
  amount: number;
  status: "paid" | "failed";
};
const sign = (e: Event) =>
  createHmac("sha256", process.env.PAYMENT_SANDBOX_SECRET!)
    .update(`${e.intentId}|${e.providerTxnId}|${e.amount}|${e.status}`)
    .digest("hex");

test("guardian pays online through the sandbox; the webhook records it once", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !process.env.PAYMENT_SANDBOX_SECRET,
    "PAYMENT_SANDBOX_SECRET is not set",
  );
  const s = await setup();
  try {
    await s.db
      .from("fee_settings")
      .update({ online_payment_enabled: false, payment_provider: "manual" })
      .eq("id", 1);
    // Switched off: no Pay now.
    await loginAs(page, "guardian@sunrise.test");
    await page.goto(`/en/dashboard/my-children/${s.studentId}/fees`);
    await expect(page.getByTestId("fees-due")).toContainText("৳500.00");
    await expect(page.getByRole("button", { name: "Pay now" })).toHaveCount(0);
    await logout(page);

    // Only an admin switches it on; gateways not set up cannot be chosen.
    await loginAs(page, "accountant@sunrise.test");
    await page.goto("/en/dashboard/fees/settings");
    await expect(page.getByLabel("Families can pay online")).toHaveCount(0);
    await logout(page);
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/fees/settings");
    await expect(
      page.getByRole("option", { name: /bKash \(not set up\)/ }),
    ).toBeDisabled();
    await page.getByLabel("Families can pay online").check();
    await page.getByLabel("Payment gateway").selectOption("sandbox");
    await page.getByRole("button", { name: "Save" }).last().click();
    await expect(page.getByText("Saved.").last()).toBeVisible();
    await logout(page);

    // The guardian pays; first the gateway fails, then it succeeds.
    await loginAs(page, "guardian@sunrise.test");
    await page.goto(`/en/dashboard/my-children/${s.studentId}/fees`);
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page).toHaveURL(
      /\/dashboard\/payments\/[0-9a-f-]{36}\/sandbox$/,
    );
    await expect(page.getByTestId("sandbox-amount")).toHaveText("৳500.00");
    await page.getByRole("button", { name: "Fail (test)" }).click();
    await expect(page.getByTestId("payment-status")).toContainText(
      "did not go through",
    );

    await page.goto(`/en/dashboard/my-children/${s.studentId}/fees`);
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page).toHaveURL(/\/sandbox$/);
    const intentId = page.url().match(/payments\/([0-9a-f-]{36})\//)![1]!;
    await page.getByRole("button", { name: "Pay (test)" }).click();
    await expect(page.getByTestId("payment-status")).toHaveText(
      "Paid. Thank you!",
    );
    await page.getByRole("link", { name: "See the receipt" }).click();
    await expect(page.getByTestId("receipt")).toContainText("Online");
    await expect(page.getByTestId("receipt-total")).toHaveText("৳500.00");
    const { data: inv } = await s.db
      .from("invoices")
      .select("status, paid")
      .eq("id", s.invoiceId)
      .single();
    expect(inv).toEqual({ status: "paid", paid: 50000 });

    // The gateway sends the same webhook again: nothing more is recorded.
    const { data: intent } = await s.db
      .from("payment_intents")
      .select("provider_txn_id, amount")
      .eq("id", intentId)
      .single();
    const again: Event = {
      intentId,
      providerTxnId: intent!.provider_txn_id!,
      amount: intent!.amount,
      status: "paid",
    };
    const url = "/api/payments/webhook/sandbox";
    const dup = await page.request.post(url, {
      headers: { "x-sandbox-signature": sign(again) },
      data: again,
    });
    expect(dup.status()).toBe(200);
    expect(await dup.json()).toEqual({ ok: true, outcome: "duplicate" });
    // A forged one is refused; an unknown gateway too.
    const forged = await page.request.post(url, {
      headers: { "x-sandbox-signature": sign({ ...again, amount: 1 }) },
      data: again,
    });
    expect(forged.status()).toBe(401);
    expect(
      (
        await page.request.post("/api/payments/webhook/bkash", { data: again })
      ).status(),
    ).toBe(404);
    const { count } = await s.db
      .from("payment_allocations")
      .select("id", { count: "exact", head: true })
      .in(
        "invoice_item_id",
        (
          (
            await s.db
              .from("invoice_items")
              .select("id")
              .eq("invoice_id", s.invoiceId)
          ).data ?? []
        ).map((i) => i.id),
      );
    expect(count).toBe(1);

    // Nothing is due any more.
    await page.goto(`/en/dashboard/my-children/${s.studentId}/fees`);
    await expect(page.getByRole("button", { name: "Pay now" })).toHaveCount(0);
  } finally {
    await cleanup(s);
  }
});

test("a webhook with the wrong amount records nothing", async ({ request }) => {
  test.skip(
    !process.env.PAYMENT_SANDBOX_SECRET,
    "PAYMENT_SANDBOX_SECRET is not set",
  );
  const s = await setup();
  try {
    const { data: intent } = await s.db
      .from("payment_intents")
      .insert({
        student_id: s.studentId,
        item_ids: (
          (
            await s.db
              .from("invoice_items")
              .select("id")
              .eq("invoice_id", s.invoiceId)
          ).data ?? []
        ).map((i) => i.id),
        amount: 50000,
        provider: "sandbox",
      })
      .select("id")
      .single();
    const e: Event = {
      intentId: intent!.id,
      providerTxnId: "SBX-E2EMISMATCH",
      amount: 40000,
      status: "paid",
    };
    const r = await request.post("/api/payments/webhook/sandbox", {
      headers: { "x-sandbox-signature": sign(e) },
      data: e,
    });
    expect(r.status()).toBe(409);
    expect(await r.json()).toEqual({ error: "amount_mismatch" });
    const { data: inv } = await s.db
      .from("invoices")
      .select("paid")
      .eq("id", s.invoiceId)
      .single();
    expect(inv!.paid).toBe(0);
  } finally {
    await cleanup(s);
  }
});
