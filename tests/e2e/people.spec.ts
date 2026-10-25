import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

const uid = () => `${Date.now()}${Math.round(Math.random() * 1e4)}`;
/** A made-up client address, so each test has its own contact-form rate limit. */
const fakeIp = () =>
  `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

async function staffId(name: string) {
  const { data } = await adminClient()
    .from("staff")
    .select("id")
    .eq("full_name_en", name)
    .single();
  return data!.id;
}

test("a staff profile page shows public fields only, never NID, birth date or address", async ({
  page,
}) => {
  const id = await staffId("Kamal Hossain");
  for (const lang of ["en", "bn"] as const) {
    const response = await page.goto(`/${lang}/teachers/${id}`);
    expect(response?.status()).toBe(200);
    const html = await response!.text();
    for (const secret of [
      "1990000000003",
      "1982-11-02",
      "2 November 1982",
      "House 9, Demo Town",
      "01910000003",
      "teacher@sunrise.test",
    ])
      expect(html, secret).not.toContain(secret);
  }
  await page.goto(`/en/teachers/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kamal Hossain",
  );
  await expect(page.getByText("Senior Teacher").first()).toBeVisible();
  await expect(page.getByText("MSc (Mathematics), B.Ed")).toBeVisible();
  await expect(page.getByText("runs the school maths club")).toBeVisible();
});

test("the directory groups by designation and splits current and former staff", async ({
  page,
}) => {
  await page.goto("/en/teachers");
  const headings = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(headings).toHaveText([
    "Head Teacher",
    "Assistant Head Teacher",
    "Senior Teacher",
    "Assistant Teacher",
    "Staff",
  ]);
  await expect(page.getByRole("link", { name: "Mohammad Ali" })).toHaveCount(0);
  await page.getByRole("link", { name: "Former" }).click();
  await expect(page).toHaveURL(/\?status=former$/);
  await page.getByRole("link", { name: "Mohammad Ali" }).click();
  await expect(page.getByText("Former member of staff.")).toBeVisible();
});

test("governing body by term, and former head teachers", async ({ page }) => {
  await page.goto("/en/governing-body");
  await expect(
    page.getByRole("heading", { name: "Term: 1 Jan 2025 to present" }),
  ).toBeVisible();
  await expect(page.getByText("Md. Anwar Hossain")).toBeVisible();
  await page.getByRole("link", { name: "Former" }).click();
  await expect(page.getByRole("heading", { name: /^Term: / })).toHaveCount(2);
  await expect(page.getByText("Md. Salim Reza")).toBeVisible();
  await page.goto("/bn/ex-principals");
  await expect(page.getByText("আবুল কাশেম")).toBeVisible();
  await expect(page.getByText("১৯৭৫ থেকে ১৯৯০")).toBeVisible();
});

async function fillContact(page: Page, lang: "en" | "bn", message: string) {
  const l =
    lang === "en"
      ? {
          name: "Your name",
          phone: "Mobile number",
          subject: "Subject",
          message: "Message",
        }
      : {
          name: "আপনার নাম",
          phone: "মোবাইল নম্বর",
          subject: "বিষয়",
          message: "বার্তা",
        };
  await page.getByLabel(l.name).fill("E2E Visitor");
  await page.getByLabel(l.phone).fill("01711000000");
  await page.getByLabel(l.subject, { exact: true }).fill(message);
  await page
    .getByLabel(l.message, { exact: true })
    .fill(`${message} — please call me back.`);
}

for (const lang of ["en", "bn"] as const) {
  test(`contact form shows validation errors in ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/contact`);
    const send = lang === "en" ? "Send message" : "বার্তা পাঠান";
    await page
      .getByLabel(lang === "en" ? "Mobile number" : "মোবাইল নম্বর")
      .fill("123");
    await page
      .getByLabel(lang === "en" ? "Message" : "বার্তা", { exact: true })
      .fill("Hi");
    await page.getByRole("button", { name: send }).click();
    const expected =
      lang === "en"
        ? [
            "This field is required.",
            "Enter an 11-digit mobile number, e.g. 01712345678.",
            "Write at least 10 characters.",
          ]
        : [
            "এই ঘরটি পূরণ করা আবশ্যক।",
            "১১ সংখ্যার মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮।",
            "কমপক্ষে ১০টি অক্ষর লিখুন।",
          ];
    for (const text of expected)
      await expect(page.getByText(text).first()).toBeVisible();
    await expect(
      page.getByLabel(lang === "en" ? "Your name" : "আপনার নাম"),
    ).toHaveAttribute("aria-invalid", "true");
  });
}

test("a contact message reaches the admin inbox, can be marked and deleted", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
  const subject = `E2E question ${uid()}`;
  await page.goto("/en/contact");
  await fillContact(page, "en", subject);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Thank you. Your message has been sent."),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("");

  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/messages?show=unread");
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(subject);
  await expect(page.getByText("please call me back")).toBeVisible();
  await page.getByRole("button", { name: "Mark as unread" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/messages$/);
  await page.goto("/en/dashboard/messages?show=unread");
  await expect(
    page.getByRole("link", { name: new RegExp(subject) }),
  ).toBeVisible();
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/messages$/);
  await expect(
    page.getByRole("link", { name: new RegExp(subject) }),
  ).toHaveCount(0);
});

test("the contact form allows 5 messages an hour from one address and ignores bots", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
  const subject = `E2E limit ${uid()}`;
  await page.goto("/en/contact");
  // A bot fills the hidden field: it is told "sent" but nothing is stored.
  await fillContact(page, "en", `${subject} bot`);
  await page
    .locator("#contact-website")
    .fill("http://spam.test", { force: true });
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Thank you. Your message has been sent."),
  ).toBeVisible();

  for (let i = 1; i <= 6; i++) {
    await fillContact(page, "en", `${subject} ${i}`);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText(
        i <= 5
          ? "Thank you. Your message has been sent."
          : "Too many messages were sent from your network. Please try again in an hour.",
      ),
    ).toBeVisible();
  }
  const db = adminClient();
  const { count } = await db
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .like("subject", `${subject}%`);
  expect(count).toBe(5);
  await db.from("contact_messages").delete().like("subject", `${subject}%`);
});

test("admin adds a governing body member and it shows on the public page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const name = `E2E Member ${uid()}`;
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/governing-body/new");
  await page.getByLabel("Name (English)").fill(name);
  await page.getByLabel("Position (English)").fill("Teacher Representative");
  await page.getByLabel("Term starts").fill("2025-01-01");
  await page.getByLabel("Term ends").fill("2024-01-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("The end must be after the start."),
  ).toBeVisible();
  await page.getByLabel("Term ends").fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/governing-body\/\d+$/);
  const id = page.url().split("/").pop();
  try {
    await page.goto("/en/governing-body");
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("Teacher Representative")).toBeVisible();
  } finally {
    await page.goto(`/en/dashboard/governing-body/${id}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/governing-body$/);
  }
  await page.goto("/en/governing-body");
  await expect(page.getByText(name)).toHaveCount(0);
});

test("only admins open the inbox and the people editors", async ({ page }) => {
  await loginAs(page, "teacher@sunrise.test");
  for (const path of [
    "/en/dashboard/messages",
    "/en/dashboard/governing-body",
    "/en/dashboard/ex-principals/new",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(403);
  }
});
