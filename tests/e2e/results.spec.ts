import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs, logout } from "./helpers";

const uid = () => `${Date.now()}`.slice(-6);

/**
 * An exam for Class 6 (Bangla and Mathematics) in review, with marks for everyone in
 * Class 6 except one: Rahim (6A roll 1) gets A+ in both, Mim (6A roll 6) is absent in
 * Bangla. Returns the exam id and a function that adds the missing mark.
 */
async function setUpExam(name: string) {
  const db = adminClient();
  const { data: session } = await db
    .from("academic_sessions")
    .select("id")
    .eq("is_current", true)
    .single();
  const { data: cls } = await db
    .from("classes")
    .select("id")
    .eq("level", 6)
    .single();
  const { data: exam } = await db
    .from("exams")
    .insert({ name_en: name, session_id: session!.id, status: "marks_entry" })
    .select("id")
    .single();
  await db
    .from("exam_classes")
    .insert({ exam_id: exam!.id, class_id: cls!.id });
  const { data: subjects } = await db
    .from("subjects")
    .select("id, code")
    .in("code", ["BAN", "MATH"]);
  const { data: papers } = await db
    .from("exam_subjects")
    .insert(
      subjects!.map((s) => ({
        exam_id: exam!.id,
        class_id: cls!.id,
        subject_id: s.id,
        cq_full: 70,
        cq_pass: 23,
        mcq_full: 30,
        mcq_pass: 10,
      })),
    )
    .select("id, subject_id");
  const { data: pupils } = await db
    .from("enrollments")
    .select("student_id, roll, section:sections!inner(name_en, class_id)")
    .eq("session_id", session!.id)
    .eq("section.class_id", cls!.id);
  const bangla = papers!.find(
    (p) => p.subject_id === subjects!.find((s) => s.code === "BAN")!.id,
  )!.id;
  const rows = [];
  let missing: Record<string, unknown> | null = null;
  for (const p of pupils!) {
    const section = (p.section as unknown as { name_en: string }).name_en;
    for (const paper of papers!) {
      const top = section === "A" && p.roll === 1;
      const mark = {
        exam_subject_id: paper.id,
        student_id: p.student_id,
        cq: top ? 60 : 40,
        mcq: top ? 25 : 15,
        is_absent: false,
      };
      if (section === "A" && p.roll === 6 && paper.id === bangla)
        rows.push({ ...mark, cq: null, mcq: null, is_absent: true });
      else if (section === "B" && p.roll === 1 && paper.id === bangla)
        missing = mark;
      else rows.push(mark);
    }
  }
  const { error } = await db.from("marks").insert(rows);
  if (error) throw error;
  await db.from("exams").update({ status: "review" }).eq("id", exam!.id);
  return {
    id: exam!.id,
    addMissing: async () => {
      const { error: e } = await db.from("marks").insert(missing!);
      if (e) throw e;
    },
  };
}

/** Waits for a notification and for it to close (on phones it can cover buttons). */
async function toast(page: Page, text: string | RegExp) {
  const note = page.getByText(text).last();
  await expect(note).toBeVisible();
  // Notifications pause while the pointer rests on them.
  await page.mouse.move(1, 1);
  await expect(note).toBeHidden({ timeout: 15_000 });
}

async function confirmClick(page: Page, name: string) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name }).click();
}

test("admin processes and publishes results; visitors and guardians see the mark sheet", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const name = `E2E Results ${uid()}`;
  const exam = await setUpExam(name);
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto(`/en/dashboard/exams/${exam.id}?tab=results`);
    await expect(page.getByTestId("results-state")).toHaveText(
      "Results have not been processed yet.",
    );

    // Publishing needs processed results.
    await confirmClick(page, "Move to: Published");
    await toast(
      page,
      "Process the results after the last change to marks, then publish.",
    );
    await expect(page.getByTestId("exam-status")).toHaveText("Review");

    // A missing mark stops processing; once entered, every student gets a result.
    await confirmClick(page, "Process results");
    await toast(
      page,
      "1 marks are not entered yet. Enter them (or mark the student absent) first.",
    );
    await exam.addMissing();
    await confirmClick(page, "Process results");
    await expect(
      page.getByText(/^\d+ results processed\.$/).last(),
    ).toBeVisible();
    await expect(page.getByTestId("results-state")).toContainText(
      "Last processed:",
    );
    await expect(page.getByTestId("results-summary")).toContainText("Failed1");

    // Tabulation sheet: Rahim first in 6A with GPA 5.00, Mim failed (absent).
    await page
      .getByRole("link", { name: "Tabulation sheet: Class 6 A" })
      .click();
    const sheet = page.getByTestId("tabulation");
    await expect(sheet.getByRole("row", { name: /Rahim Ahmed/ })).toContainText(
      "5.00",
    );
    await expect(sheet.getByRole("row", { name: /Mim Akter/ })).toContainText(
      "Absent",
    );
    await expect(sheet.getByRole("row", { name: /Mim Akter/ })).toContainText(
      "Failed",
    );

    // Mark sheet, and its PDF.
    await sheet.getByRole("link", { name: "Rahim Ahmed" }).click();
    await expect(page.getByTestId("mark-sheet-summary")).toContainText(
      "GPA5.00",
    );
    const pdf = await page.request.get(`${page.url()}/pdf`);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.goto(`/en/dashboard/exams/${exam.id}?tab=results`);
    await confirmClick(page, "Move to: Published");
    await expect(page.getByTestId("exam-status")).toHaveText("Published");
    await logout(page);

    // A visitor finds the mark sheet by class, section and roll.
    await page.goto("/en/result");
    await page.getByLabel("Exam").selectOption({ label: name });
    await page
      .getByLabel("Class", { exact: true })
      .selectOption({ label: "Class 6" });
    await page.getByLabel("Section").selectOption({ label: "A" });
    await page.getByLabel("Roll number").fill("1");
    await page.getByRole("button", { name: "Show result" }).click();
    const card = page.getByTestId("mark-sheet");
    await expect(card).toContainText("Rahim Ahmed");
    await expect(card).toContainText("Mark sheet: " + name);
    await expect(page.getByTestId("mark-sheet-summary")).toContainText(
      "GPA5.00",
    );
    // No student ID on the public page.
    await expect(card).not.toContainText("Student ID");

    // The guardian sees the same result in the portal.
    await loginAs(page, "guardian@sunrise.test");
    await page.goto("/en/dashboard/my-children");
    await page
      .getByTestId("portal-student")
      .filter({ hasText: "Rahim Ahmed" })
      .getByRole("link", { name: "Results" })
      .click();
    await page.getByRole("link", { name: `Mark sheet: ${name}` }).click();
    await expect(page.getByTestId("mark-sheet")).toContainText("Student ID");
    await expect(page.getByTestId("mark-sheet-summary")).toContainText(
      "Passed",
    );
  } finally {
    await adminClient().from("exams").delete().eq("id", exam.id);
  }
});

test("result search checks the form and says when nothing matches (Bangla)", async ({
  page,
}) => {
  await page.goto("/bn/result?exam=1&class=1&section=1&roll=abc");
  await expect(page.getByText("রোল নম্বর লিখুন (১–৯৯৯)।")).toBeVisible();
  await expect(page.getByLabel("রোল নম্বর")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("রোল নম্বর").fill("৯৯৯");
  await page.getByRole("button", { name: "ফলাফল দেখুন" }).click();
  await expect(
    page.getByText("কোনো ফলাফল পাওয়া যায়নি। তথ্যগুলো দেখে আবার চেষ্টা করুন।"),
  ).toBeVisible();
  // Seeded Half Yearly results: Mim (6A roll 6) failed Mathematics, shown in Bangla.
  await page.getByLabel("রোল নম্বর").fill("৬");
  await page.getByRole("button", { name: "ফলাফল দেখুন" }).click();
  await expect(page.getByTestId("mark-sheet")).toContainText("মিম আক্তার");
  await expect(page.getByTestId("mark-sheet-summary")).toContainText(
    "অনুত্তীর্ণ",
  );
  await expect(page.getByTestId("mark-sheet")).toContainText("শিক্ষাবর্ষ২০২৬");
});

test("board results: the office adds a year and the website shows it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const db = adminClient();
  try {
    await loginAs(page, "admin@sunrise.test");
    await page.goto("/en/dashboard/board-results");
    await page.getByRole("button", { name: "Add board result" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Year").fill("2018");
    await dialog.getByLabel("Examinees").fill("100");
    await dialog.getByLabel("Passed").fill("120");
    await dialog.getByLabel("GPA 5.00").fill("10");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByText("Passed cannot be more than examinees."),
    ).toBeVisible();
    await dialog.getByLabel("Passed").fill("90");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("row", { name: /2018/ })).toContainText("90%");
    await logout(page);

    await page.goto("/en/board-results");
    await expect(page.getByTestId("pass-rate-chart")).toBeVisible();
    await expect(
      page.getByTestId("board-results").getByRole("row", { name: /2018/ }),
    ).toContainText("90%");
  } finally {
    await db.from("board_results").delete().eq("year", 2018);
  }
});

test("teachers cannot open board results or result processing", async ({
  page,
}) => {
  await loginAs(page, "teacher@sunrise.test");
  expect((await page.goto("/en/dashboard/board-results"))?.status()).toBe(403);
  expect((await page.goto("/en/dashboard/exams/1/tabulation"))?.status()).toBe(
    403,
  );
  const pdf = await page.request.get(
    "/en/dashboard/exams/1/tabulation/pdf?section=1",
    {
      maxRedirects: 0,
    },
  );
  expect(pdf.status()).toBe(403);
});
