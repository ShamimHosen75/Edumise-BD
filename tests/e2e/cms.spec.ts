import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs } from "./helpers";

const uid = () => `e2e-${Date.now()}-${Math.round(Math.random() * 1e5)}`;

/** A draft page created directly in the database for one test. */
async function createDraftPage(title = "E2E draft page") {
  const slug = uid();
  const { data, error } = await adminClient()
    .from("pages")
    .insert({ slug, title_en: title, body_en: "", is_published: false })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  return { id: data.id, slug };
}

async function deleteViaUi(page: Page, lang: "en" | "bn", id: number) {
  await page.goto(`/${lang}/dashboard/pages/${id}`);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: lang === "en" ? "Delete page" : "পেজ মুছুন" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/dashboard/pages$`));
}

test("admin edits a page in Bangla, publishes it, and the public page shows the new text", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const draft = await createDraftPage();
  await loginAs(page, "admin@sunrise.test");
  try {
    // Before publishing the page is not public.
    expect((await page.request.get(`/bn/p/${draft.slug}`)).status()).toBe(404);

    await page.goto(`/bn/dashboard/pages?q=${draft.slug}`);
    await page.getByRole("link", { name: /সম্পাদনা/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`/bn/dashboard/pages/${draft.id}$`),
    );

    await page.getByRole("tab", { name: "বাংলা" }).click();
    await page
      .getByRole("tabpanel", { name: "বাংলা" })
      .getByLabel("শিরোনাম", { exact: true })
      .fill("পরীক্ষামূলক পেজ");
    const editor = page.getByRole("textbox", { name: "বিষয়বস্তু" }).last();
    await editor.click();
    await page.keyboard.type("নতুন লেখা সফলভাবে প্রকাশিত হয়েছে");
    // English body too, so the page is not empty in either language.
    await page.getByRole("tab", { name: "ইংরেজি" }).click();
    await page.getByRole("textbox", { name: "বিষয়বস্তু" }).first().click();
    await page.keyboard.type("English text");

    await page.getByLabel("ওয়েবসাইটে প্রকাশিত").check();
    await page.getByRole("button", { name: "পেজ সংরক্ষণ করুন" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "পেজ সংরক্ষিত হয়েছে।" }),
    ).toBeVisible();

    await page.goto(`/bn/p/${draft.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "পরীক্ষামূলক পেজ",
    );
    await expect(page.locator("article")).toContainText(
      "নতুন লেখা সফলভাবে প্রকাশিত হয়েছে",
    );
    await page.goto(`/en/p/${draft.slug}`);
    await expect(page.locator("article")).toContainText("English text");
  } finally {
    await deleteViaUi(page, "en", draft.id);
  }
  expect((await page.request.get(`/en/p/${draft.slug}`)).status()).toBe(404);
});

test("admin creates a page, links it in the menu, and it appears in the header", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "desktop header menu");
  test.setTimeout(90_000);
  const slug = uid();
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/pages/new");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .first()
    .fill("Science club");
  await page.getByLabel("Page address").fill(slug);
  await page.getByRole("textbox", { name: "Content" }).first().click();
  await page.keyboard.type("Meets every Thursday.");
  await page.getByLabel("Published on the website").check();
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/pages\/\d+$/);
  const pageId = Number(page.url().split("/").pop());

  try {
    await page.goto("/en/dashboard/menu");
    await page.getByRole("button", { name: /^Add item\s*:\s*About$/ }).click();
    const form = page
      .locator("form")
      .filter({ has: page.getByLabel("Name (English)") });
    await form.getByLabel("Name (English)").fill("Science club");
    await form
      .getByLabel("Page", { exact: true })
      .selectOption({ label: `Science club (/p/${slug})` });
    await form.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Menu updated." }),
    ).toBeVisible();

    await page.goto("/en");
    await page.getByRole("button", { name: "About" }).click();
    await page.getByRole("link", { name: "Science club" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/p/${slug}$`));

    // Remove the menu item again.
    await page.goto("/en/dashboard/menu");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete Science club" }).click();
    await expect(
      page.getByRole("button", { name: "Delete Science club" }),
    ).toHaveCount(0);
  } finally {
    await deleteViaUi(page, "en", pageId);
  }
});

test("menu items can be moved up and down", async ({ page }) => {
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/menu");
  const names = () => page.locator('[data-menu-level="top"]').allInnerTexts();
  const before = await names();
  let moved = false;
  try {
    await page.getByRole("button", { name: "Move About down" }).click();
    moved = true;
    await expect
      .poll(names)
      .toEqual([before[0], before[2], before[1], ...before.slice(3)]);
  } finally {
    // Always put the menu back, so other tests see the seeded order.
    if (moved)
      await page.getByRole("button", { name: "Move About up" }).click();
  }
  await expect.poll(names).toEqual(before);
});

test("saved HTML cannot run scripts on the public page", async ({ page }) => {
  const slug = uid();
  const { data } = await adminClient()
    .from("pages")
    .insert({
      slug,
      title_en: "XSS check",
      body_en:
        '<p>Safe text</p><script>window.__xss = 1</script><img src="x" onerror="window.__xss = 2"><a href="javascript:window.__xss=3">x</a>',
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  try {
    await page.goto(`/en/p/${slug}`);
    await expect(page.locator("article")).toContainText("Safe text");
    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
    await expect(
      page.locator(
        "article script, article [onerror], article a[href^='javascript']",
      ),
    ).toHaveCount(0);
  } finally {
    await adminClient().from("pages").delete().eq("id", data!.id);
  }
});

test("empty and unpublished pages are hidden from the menu and return 404", async ({
  page,
}) => {
  for (const slug of ["donors", "history"]) {
    expect((await page.request.get(`/en/p/${slug}`)).status(), slug).toBe(404);
  }
  await page.goto("/en");
  const html = await page.locator("header").innerHTML();
  expect(html).not.toContain("/p/donors");
  expect(html).not.toContain("/p/history");
});

test("attachments: a real PDF is shown on the page, a fake one is refused", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const draft = await createDraftPage("Attachment test");
  await adminClient()
    .from("pages")
    .update({
      body_en: "<p>Files below.</p>",
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", draft.id);
  await loginAs(page, "admin@sunrise.test");
  try {
    await page.goto(`/en/dashboard/pages/${draft.id}`);
    await page.getByLabel("Attachment name", { exact: true }).fill("Fake PDF");
    await page.getByLabel("File").setInputFiles({
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html><script>alert(1)</script></html>"),
    });
    await page.getByRole("button", { name: "Upload attachment" }).click();
    await expect(
      page.getByText("The file must be a PDF, PNG, JPG or WebP."),
    ).toBeVisible();

    await page
      .getByLabel("Attachment name", { exact: true })
      .fill("Admission form");
    await page.getByLabel("File").setInputFiles({
      name: "form.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
      ),
    });
    await page.getByRole("button", { name: "Upload attachment" }).click();
    await expect(
      page.getByRole("link", { name: "Admission form" }),
    ).toBeVisible();

    await page.goto(`/en/p/${draft.slug}`);
    await expect(
      page.getByRole("link", { name: /Admission form/ }),
    ).toBeVisible();
  } finally {
    await deleteViaUi(page, "en", draft.id);
  }
});

test("only admins can open the page editor and menu builder", async ({
  page,
}) => {
  await loginAs(page, "teacher@sunrise.test");
  for (const path of [
    "/en/dashboard/pages",
    "/en/dashboard/pages/new",
    "/en/dashboard/menu",
  ]) {
    expect((await page.goto(path))?.status(), path).toBe(403);
  }
});
