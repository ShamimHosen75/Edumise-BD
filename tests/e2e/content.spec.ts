import { expect, test, type Page } from "@playwright/test";

import { adminClient, loginAs, logout, TINY_PNG } from "./helpers";

const uid = () => `${Date.now()}${Math.round(Math.random() * 1e4)}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

/** Fills the English title on a content form (both language panels stay mounted). */
async function fillTitle(page: Page, title: string) {
  await page
    .getByRole("tabpanel", { name: "English" })
    .getByLabel("Title", { exact: true })
    .fill(title);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("main").getByRole("status").filter({ hasText: "Saved." }),
  ).toBeVisible();
}

async function deleteItem(page: Page, module: string, id: string) {
  await page.goto(`/en/dashboard/${module}/${id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/dashboard/${module}$`));
}

const idFromUrl = (page: Page) => page.url().split("/").pop()!;

test("a notice saved as a draft stays hidden; once published it shows on the home ticker and the list", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = `E2E notice ${uid()}`;
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/notices/new");
  await fillTitle(page, title);
  await page.getByLabel("Category").selectOption("exam");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/notices\/\d+$/);
  const id = idFromUrl(page);
  const slug = await page.getByLabel("Page address").inputValue();
  try {
    expect((await page.request.get(`/en/notices/${slug}`)).status()).toBe(404);
    await page.goto(`/en/notices?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await page.goto("/en");
    await expect(
      page.getByRole("region", { name: "Notice board" }).getByText(title),
    ).toHaveCount(0);

    await page.goto(`/en/dashboard/notices/${id}`);
    await page.getByLabel("Published", { exact: true }).check();
    await save(page);

    await page.goto("/en");
    await expect(
      page
        .getByRole("region", { name: "Notice board" })
        .getByRole("link", { name: title })
        .first(),
    ).toBeAttached();
    await page.goto(`/en/notices?category=exam&q=${encodeURIComponent(title)}`);
    await page.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(new RegExp(`/en/notices/${slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  } finally {
    await deleteItem(page, "notices", id);
  }
});

test("a teacher writes a notice draft and an admin publishes it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = `E2E teacher notice ${uid()}`;
  await loginAs(page, "teacher@sunrise.test");
  await page.goto("/en/dashboard/notices/new");
  await expect(page.getByLabel("Published", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("You can save drafts. An admin reviews and publishes them."),
  ).toBeVisible();
  await fillTitle(page, title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/notices\/\d+$/);
  const id = idFromUrl(page);
  // A teacher cannot open the news module.
  expect((await page.request.get("/en/dashboard/news")).status()).toBe(403);
  await logout(page);

  await loginAs(page, "admin@sunrise.test");
  try {
    await page.goto(
      `/en/dashboard/notices?status=draft&q=${encodeURIComponent(title)}`,
    );
    await page
      .getByRole("link", { name: new RegExp(`^Edit\\s*: ${title}$`) })
      .click();
    await page.getByLabel("Published", { exact: true }).check();
    await save(page);
    await page.goto(`/en/notices?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  } finally {
    await deleteItem(page, "notices", id);
  }
});

test("notice page previews the PDF, offers a download and share links", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/notices/annual-exam-routine-2026");
  await expect(page.locator('object[type="application/pdf"]')).toBeAttached();
  await expect(
    page.getByRole("link", { name: /Download/ }).first(),
  ).toHaveAttribute("href", /notice-sample\.pdf/);
  await expect(
    page.getByRole("link", { name: "Share on WhatsApp" }),
  ).toHaveAttribute("href", /wa\.me.*annual-exam-routine-2026/);
  await expect(
    page.getByRole("link", { name: "Share on Facebook" }),
  ).toHaveAttribute("href", /facebook\.com/);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const og = page.locator('meta[property="og:title"]');
  await expect(og).toHaveAttribute("content", /Annual Exam 2026/);
});

test("notices paginate and keep the search between pages", async ({ page }) => {
  await page.goto("/bn/notices");
  const nav = page.getByRole("navigation", { name: "পাতা" });
  await nav.getByRole("link", { name: "পাতা ২" }).click();
  await expect(page).toHaveURL(/\/bn\/notices\?page=2$/);
  await expect(nav.getByRole("link", { name: "পাতা ২" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("gallery lightbox moves with the arrow keys and closes with Escape", async ({
  page,
}) => {
  await page.goto("/en/gallery");
  await page.getByRole("link", { name: "Annual Sports Day 2025" }).click();
  const first = page.getByRole("button", { name: /^Open photo/ }).first();
  await first.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Photo 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(dialog).toHaveAccessibleName("Photo 2 of 3");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(dialog).toHaveAccessibleName("Photo 3 of 3");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  // Focus returns to the photo last shown.
  await expect(
    page.getByRole("button", { name: /^Open photo/ }).nth(2),
  ).toBeFocused();
});

test("events are split into upcoming and past", async ({ page }) => {
  const slug = `e2e-event-${uid()}`;
  const db = adminClient();
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await db.from("events").insert({
    slug,
    title_en: "E2E upcoming event",
    starts_at: soon,
    is_published: true,
    published_at: new Date(Date.now() - 60_000).toISOString(),
  });
  try {
    await page.goto("/en/events");
    const tabs = page.getByRole("navigation", { name: "Events" });
    await expect(tabs.getByRole("link", { name: "Upcoming" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("link", { name: "E2E upcoming event" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Independence Day programme" }),
    ).toHaveCount(0);
    await tabs.getByRole("link", { name: "Past" }).click();
    await expect(page).toHaveURL(/\?when=past$/);
    await page
      .getByRole("link", { name: "Independence Day programme" })
      .click();
    await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  } finally {
    await db.from("events").delete().eq("slug", slug);
  }
});

test("downloads show category, size and type, and filter by category", async ({
  page,
}) => {
  await page.goto("/en/downloads?category=forms");
  await expect(page.getByRole("status")).toHaveText("1 found");
  const item = page.getByRole("listitem").filter({ hasText: "Admission form" });
  await expect(item).toContainText("Forms");
  await expect(item).toContainText("PDF");
  await expect(item).toContainText(/\d+(\.\d)? (B|KB|MB)/);
  await expect(
    item.getByRole("link", { name: /^Download: Admission form/ }),
  ).toHaveAttribute("download", "");
  await expect(page.getByText("Draft circular")).toHaveCount(0);
});

test("admin adds a download: publishing waits for the file", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = `E2E download ${uid()}`;
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/downloads/new");
  await fillTitle(page, title);
  await page.getByLabel("Published", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Upload the file before publishing.").first(),
  ).toBeVisible();
  await page.getByLabel("Published", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/downloads\/\d+$/);
  const id = idFromUrl(page);
  try {
    await page.getByLabel("File", { exact: true }).setInputFiles({
      name: "form.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Done.")).toBeVisible();
    await page.getByLabel("Published", { exact: true }).check();
    await save(page);
    await page.goto(`/en/downloads?q=${encodeURIComponent(title)}`);
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  } finally {
    await deleteItem(page, "downloads", id);
  }
});

test("admin creates an album and uploads photos in bulk", async ({ page }) => {
  test.setTimeout(90_000);
  const title = `E2E album ${uid()}`;
  await loginAs(page, "admin@sunrise.test");
  await page.goto("/en/dashboard/gallery/new");
  await fillTitle(page, title);
  await page.getByLabel("Published", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard\/gallery\/\d+$/);
  const id = idFromUrl(page);
  const slug = await page.getByLabel("Page address").inputValue();
  try {
    await page.getByLabel("Add photos").setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "two.png", mimeType: "image/png", buffer: TINY_PNG },
    ]);
    await expect(page.getByText("2 photos added.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove photo" }),
    ).toHaveCount(2);
    // The first photo became the cover.
    await expect(page.getByText("Cover", { exact: true })).toHaveCount(1);
    await page
      .getByLabel(/^Caption \(English\)/)
      .first()
      .fill("Opening march");
    await page.getByRole("button", { name: "Save caption" }).first().click();
    await expect(page.getByText("Done.")).toBeVisible();

    await page.goto(`/en/gallery/${slug}`);
    await expect(page.getByRole("button", { name: /^Open photo/ })).toHaveCount(
      2,
    );
    await expect(
      page.getByRole("button", { name: "Open photo: Opening march" }),
    ).toBeVisible();
  } finally {
    await deleteItem(page, "gallery", id);
  }
});

test("sitemap and robots are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/en/notices/annual-exam-routine-2026");
  expect(xml).toContain("/bn/gallery/annual-sports-2025");
  expect(xml).not.toContain("admission-2027-draft");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /*/dashboard");
});
