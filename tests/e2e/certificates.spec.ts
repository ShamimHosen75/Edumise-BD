import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs, logout } from "./helpers";

/** A throwaway student (not enrolled, so other tests' class lists stay the same). */
async function makeStudent() {
  const code = `2099${`${Date.now()}`.slice(-6)}`;
  const name = `E2E Certificate ${code.slice(-6)}`;
  const { data, error } = await adminClient()
    .from("students")
    .insert({ student_code: code, full_name_en: name, gender: "female" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as number, code, name };
}

async function verifyFromHeader(page: Page, typed: string) {
  await page.goto("/en");
  await page.getByRole("button", { name: "Verify" }).click();
  const dialog = page.getByRole("dialog", { name: "Verify a certificate" });
  await dialog.getByLabel("Reference").fill(typed);
  await dialog.getByRole("button", { name: "Check" }).click();
}

test("admin issues a transfer certificate; the website verifies it, then shows it revoked", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = adminClient();
  const student = await makeStudent();
  let reference = "";
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/certificates/new");
    await page.getByLabel("Student ID", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(
      page.getByText("Enter the 10-digit student ID."),
    ).toBeVisible();

    await page.getByLabel("Student ID", { exact: true }).fill(student.code);
    await page
      .getByLabel("Certificate", { exact: true })
      .selectOption({ label: "Transfer certificate" });
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByTestId("certificate-student")).toHaveText(
      `${student.name} (not enrolled)`,
    );
    await expect(page.getByLabel("Text (English)")).toHaveValue(
      new RegExp(`^This is to certify that ${student.name} was a student`),
    );
    await expect(
      page.getByText("The student will be marked as transferred."),
    ).toBeVisible();
    await page
      .getByLabel("Text (English)")
      .fill("Edited text for the transfer certificate.");
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.accept();
    });
    await page.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/certificates\/\d+$/);
    expect(dialogs).toBe(2); // issue + transfer confirmation
    reference = (await page
      .getByTestId("certificate-reference")
      .textContent())!;
    expect(reference).toMatch(
      /^TC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/,
    );
    await expect(page.getByTestId("certificate")).toContainText(
      "Edited text for the transfer certificate.",
    );
    const pdf = await page.request.get(`${page.url()}/pdf`);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const { data: s } = await db
      .from("students")
      .select("status")
      .eq("id", student.id)
      .single();
    expect(s!.status).toBe("transferred");
    await logout(page);

    // A visitor checks it from the header, typing it loosely: valid, name only.
    await verifyFromHeader(page, reference.toLowerCase().replaceAll("-", " "));
    await expect(page).toHaveURL(new RegExp(`/en/verify/${reference}$`));
    await expect(page.getByTestId("verify-status")).toHaveText(
      "Valid certificate",
    );
    const result = page.getByTestId("verify-result");
    await expect(result).toContainText(student.name);
    await expect(result).toContainText("Transfer certificate");
    await expect(result).not.toContainText(student.code);
    await expect(result).not.toContainText("Edited text");

    // The office revokes it.
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/certificates");
    await page
      .getByRole("link", { name: `View certificate ${reference}` })
      .click();
    await page.getByRole("button", { name: "Revoke" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Revoke" }).click();
    await expect(dialog.getByText("This field is required.")).toBeVisible();
    await dialog.getByLabel("Reason").fill("Issued by mistake");
    await dialog.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Certificate revoked.").last()).toBeVisible();
    await expect(page.getByTestId("certificate")).toContainText("Revoked");
    await logout(page);

    await page.goto(`/en/verify/${reference}`);
    await expect(page.getByTestId("verify-status")).toHaveText(
      "This certificate has been revoked",
    );
    await expect(page.getByTestId("verify-result")).toContainText("Revoked on");
  } finally {
    if (reference)
      await db.from("certificates").delete().eq("reference", reference);
    await db.from("students").delete().eq("id", student.id);
  }
});

test("verify page in Bangla: bad and unknown references, seeded valid and revoked ones", async ({
  page,
}) => {
  await page.goto("/bn/verify?ref=hello");
  await expect(
    page.getByText(
      "এটি সঠিক রেফারেন্স নয়। রেফারেন্স দেখতে TC-7KQ2-M9XA-4P-এর মতো।",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("রেফারেন্স")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.goto("/bn/verify/TC-2222-2222-22");
  await expect(page.getByText("এই রেফারেন্সে কোনো সনদ নেই।")).toBeVisible();

  await page.goto("/bn/verify/ts-7kq2-m9xa-4p");
  await expect(page).toHaveURL(/\/bn\/verify\/TS-7KQ2-M9XA-4P$/);
  await expect(page.getByTestId("verify-status")).toHaveText("বৈধ সনদ");
  await expect(page.getByTestId("verify-result")).toContainText("তানভীর হাসান");
  await expect(page.getByTestId("verify-result")).toContainText("প্রশংসাপত্র");

  await page.goto("/bn/verify/CC-H3RD-8WJY-6T");
  await expect(page.getByTestId("verify-status")).toHaveText(
    "এই সনদটি বাতিল করা হয়েছে",
  );
});

test("teachers cannot open certificates or their PDFs", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  expect((await page.goto("/en/dashboard/certificates"))?.status()).toBe(403);
  expect((await page.goto("/en/dashboard/certificates/new"))?.status()).toBe(
    403,
  );
  const pdf = await page.request.get("/en/dashboard/certificates/1/pdf", {
    maxRedirects: 0,
  });
  expect(pdf.status()).toBe(403);
});
