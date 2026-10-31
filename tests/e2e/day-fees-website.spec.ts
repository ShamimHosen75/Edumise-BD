import { expect, test, type Page } from "@playwright/test";

import bn from "@/dictionaries/bn.json" with { type: "json" };
import en from "@/dictionaries/en.json" with { type: "json" };
import { formatCurrency, localizeDigits } from "@/lib/format";

import { adminClient, loginAs, TINY_PNG } from "./helpers";

// Step 6.1 "day in the life": a fee month for the accountant and a website day for the
// admin, each in English and Bangla. All labels come from the dictionaries.

const LANGS = ["en", "bn"] as const;
type Lang = (typeof LANGS)[number];

const dictFor = (lang: Lang) => (lang === "en" ? en : bn);
const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pick = (row: { name_en: string; name_bn: string | null }, lang: Lang) =>
  lang === "bn" && row.name_bn ? row.name_bn : row.name_en;
const uid = () => `${Date.now()}`.slice(-6);

/** Waits for a notification and for it to close (on phones it can cover buttons). */
async function toast(page: Page, text: string) {
  const note = page.getByText(text, { exact: true }).last();
  await expect(note).toBeVisible();
  // Notifications pause while the pointer rests on them.
  await page.mouse.move(1, 1);
  await expect(note).toBeHidden({ timeout: 15_000 });
}

// ---------------------------------------------------------------- Fee month

const PAYER = "2026060005"; // Sakib Al Mamun, Class 6
const UNPAID = "2026060006"; // Mim Akter, Class 6

/** Removes everything billed and paid for one fee head, then the head itself. */
async function cleanupFees(code: string) {
  const db = adminClient();
  const { data: head } = await db
    .from("fee_heads")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!head) return;
  const { data: items } = await db
    .from("invoice_items")
    .select("id, invoice_id")
    .eq("fee_head_id", head.id);
  const itemIds = (items ?? []).map((i) => i.id);
  const invoiceIds = [...new Set((items ?? []).map((i) => i.invoice_id))];
  if (itemIds.length) {
    const { data: allocs } = await db
      .from("payment_allocations")
      .select("payment_id")
      .in("invoice_item_id", itemIds);
    const payments = [...new Set((allocs ?? []).map((a) => a.payment_id))];
    await db
      .from("payment_allocations")
      .delete()
      .in("invoice_item_id", itemIds);
    if (payments.length) {
      await db.from("payment_intents").delete().in("payment_id", payments);
      await db.from("payments").delete().in("id", payments);
    }
  }
  if (invoiceIds.length)
    await db.from("invoices").delete().in("id", invoiceIds);
  await db.from("fee_structures").delete().eq("fee_head_id", head.id);
  await db.from("fee_waivers").delete().eq("fee_head_id", head.id);
  await db.from("fee_heads").delete().eq("id", head.id);
}

/** Unticks every item on the collect screen except this test's fee head. */
async function tickOnly(page: Page, headName: string) {
  const due = page.getByTestId("due-items");
  await expect(due).toContainText(headName);
  for (const box of await due.getByRole("checkbox").all()) {
    const label = (await box.getAttribute("aria-label")) ?? "";
    if ((await box.isEnabled()) && !label.includes(headName))
      await box.uncheck();
  }
}

for (const lang of LANGS) {
  test(`fee month (${lang}): fee head, invoices, part and full payment, dues and reports`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const d = dictFor(lang);
    const money = (p: number) => formatCurrency(p, lang);
    const num = (v: number | string) => localizeDigits(v, lang);
    const code = `E2ED${lang.toUpperCase()}${uid()}`;
    const nameEn = `E2E day fee ${code}`;
    const nameBn = `ই২ই দিনের ফি ${code}`;
    const headName = lang === "en" ? nameEn : nameBn;
    const AMOUNT = 30000; // ৳300.00
    const FIRST = 12000; // ৳120.00 now, ৳180.00 later
    const db = adminClient();

    const { data: classes } = await db
      .from("classes")
      .select("id, name_en, name_bn, level")
      .order("level");
    const class6 = classes!.find((c) => c.level === 6)!;
    const className = pick(class6, lang);
    const { data: session } = await db
      .from("academic_sessions")
      .select("id")
      .eq("is_current", true)
      .single();
    const { data: enrolled } = await db
      .from("enrollments")
      .select(
        "student_id, section:sections!inner(class_id), student:students!inner(status)",
      )
      .eq("session_id", session!.id)
      .eq("section.class_id", class6.id)
      .not("student.status", "in", "(transferred,inactive)");
    const count = enrolled!.length;
    const { data: studs } = await db
      .from("students")
      .select("id, student_code, full_name_en, full_name_bn")
      .in("student_code", [PAYER, UNPAID]);
    const byCode = (c: string) => studs!.find((s) => s.student_code === c)!;
    const studentName = (c: string) =>
      lang === "bn" ? byCode(c).full_name_bn! : byCode(c).full_name_en;
    const payerName = studentName(PAYER);
    const unpaidName = studentName(UNPAID);
    // Both must owe nothing else, so the dues report shows exactly this fee.
    const { count: openBefore } = await db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("student_id", [byCode(PAYER).id, byCode(UNPAID).id])
      .in("status", ["unpaid", "partial"]);
    expect(openBefore, "test students already owe something").toBe(0);

    try {
      await loginAs(page, "accountant@sunrise.test");

      // 1. A one-time fee head.
      await page.goto(`/${lang}/dashboard/fees/heads`);
      await page
        .getByRole("button", {
          name: fill(d.academic.add, { item: d.fees.heads.item }),
        })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(d.fees.heads.code, { exact: true }).fill(code);
      await dialog
        .getByLabel(d.fees.heads.nameEn, { exact: true })
        .fill(nameEn);
      await dialog
        .getByLabel(d.fees.heads.nameBn, { exact: true })
        .fill(nameBn);
      await dialog
        .getByLabel(d.fees.heads.frequency, { exact: true })
        .selectOption({ label: d.fees.heads.frequencies.one_time });
      await dialog.getByRole("button", { name: d.dialog.save }).click();
      await expect(
        page.getByRole("row", { name: new RegExp(escapeRe(headName)) }),
      ).toContainText(code);

      // 2. Its amount for Class 6 in the fee structure.
      await page.goto(`/${lang}/dashboard/fees/structure`);
      const cell = page.getByLabel(
        fill(d.fees.structure.cellLabel, { head: headName, row: className }),
        { exact: true },
      );
      await cell.fill(lang === "bn" ? "৩০০" : "300");
      await page
        .getByRole("button", { name: d.fees.structure.save, exact: true })
        .click();
      await toast(page, d.fees.structure.saved);
      await expect(cell).toHaveValue("300");

      // 3. Make invoices for Class 6 only: preview, then make (confirm dialog).
      await page.goto(`/${lang}/dashboard/fees/generate`);
      await page.getByLabel(d.fees.generate.kinds.one_time).check();
      await page
        .getByLabel(d.fees.generate.head, { exact: true })
        .selectOption({ label: headName });
      for (const c of classes!.filter((x) => x.id !== class6.id))
        await page.getByLabel(pick(c, lang), { exact: true }).uncheck();
      await page
        .getByRole("button", { name: d.fees.generate.preview, exact: true })
        .click();
      await expect(
        page.getByTestId("generate-preview").locator("p").first(),
      ).toHaveText(
        fill(d.fees.generate.summary, {
          invoices: num(count),
          total: money(AMOUNT * count),
          waived: money(0),
          skipped: num(0),
        }),
      );
      let confirmText = "";
      page.once("dialog", (dlg) => {
        confirmText = dlg.message();
        void dlg.accept();
      });
      await page
        .getByRole("button", {
          name: fill(d.fees.generate.make, { count: num(count) }),
        })
        .click();
      await toast(
        page,
        fill(d.fees.generate.made, { created: num(count), skipped: num(0) }),
      );
      expect(confirmText).toBe(
        fill(d.fees.generate.confirm, {
          count: num(count),
          total: money(AMOUNT * count),
        }),
      );

      // 4. The invoice list shows them unpaid.
      await page.goto(
        `/${lang}/dashboard/fees?status=unpaid&class=${class6.id}`,
      );
      const list = page.getByTestId("invoice-list");
      for (const name of [payerName, unpaidName]) {
        const row = list
          .getByRole("row")
          .filter({ hasText: name })
          .filter({ hasText: money(AMOUNT) });
        await expect(row).toHaveCount(1);
        await expect(row.getByTestId("invoice-status")).toHaveText(
          d.fees.invoices.statuses.unpaid,
        );
      }

      // 5. Collect part of it (search by name in en, by ID in Bangla digits in bn).
      await page.goto(`/${lang}/dashboard/fees/collect`);
      await page
        .getByLabel(d.fees.collect.search, { exact: true })
        .fill(lang === "en" ? "Sakib" : num(PAYER));
      await page
        .getByRole("button", { name: d.fees.collect.find, exact: true })
        .click();
      await page.getByTestId("found-students").getByText(payerName).click();
      await tickOnly(page, headName);
      const amount = page.getByLabel(d.fees.collect.amount, { exact: true });
      await expect(amount).toHaveValue("300");
      await amount.fill(lang === "bn" ? "১২০" : "120");
      await page
        .getByLabel(d.fees.collect.method, { exact: true })
        .selectOption("cash");
      await expect(page.getByTestId("allocation-preview")).toContainText(
        money(FIRST),
      );
      const confirms: string[] = [];
      page.on("dialog", (dlg) => {
        confirms.push(dlg.message());
        void dlg.accept();
      });
      await page
        .getByRole("button", { name: d.fees.collect.save, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/dashboard/receipts/\\d+$`),
      );
      expect(confirms.at(-1)).toBe(
        fill(d.fees.collect.confirm, { amount: money(FIRST) }),
      );
      await expect(page.getByTestId("receipt-total")).toHaveText(money(FIRST));
      await expect(page.getByTestId("receipt-due")).toHaveText(
        money(AMOUNT - FIRST),
      );
      const firstNo = (await page.getByTestId("receipt").textContent())!.match(
        /RCP-\d{4}-\d{6}/,
      )![0];

      // ... and the rest.
      await page
        .getByRole("link", { name: d.fees.receipt.back, exact: true })
        .click();
      await tickOnly(page, headName);
      await expect(amount).toHaveValue("180");
      await page
        .getByRole("button", { name: d.fees.collect.save, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/dashboard/receipts/\\d+$`),
      );
      expect(confirms.at(-1)).toBe(
        fill(d.fees.collect.confirm, { amount: money(AMOUNT - FIRST) }),
      );
      await expect(page.getByTestId("receipt-total")).toHaveText(
        money(AMOUNT - FIRST),
      );
      await expect(page.getByTestId("receipt-due")).toHaveText(money(0));
      const secondNo = (await page.getByTestId("receipt").textContent())!.match(
        /RCP-\d{4}-\d{6}/,
      )![0];

      // 6. Dues for Class 6: the payer is gone, the unpaid student still owes.
      await page.goto(`/${lang}/dashboard/fees/reports?report=dues`);
      await page
        .getByLabel(d.fees.reports.class, { exact: true })
        .selectOption({ label: className });
      await page
        .getByRole("button", { name: d.fees.reports.show, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`class=${class6.id}`));
      const report = page.getByTestId("report");
      await expect(
        report
          .getByRole("row")
          .filter({ hasText: unpaidName })
          .filter({ hasText: money(AMOUNT) }),
      ).toHaveCount(1);
      await expect(
        report.getByRole("row").filter({ hasText: payerName }),
      ).toHaveCount(0);

      // The Excel export downloads.
      const excel = page.getByRole("link", {
        name: d.fees.reports.excel,
        exact: true,
      });
      const href = (await excel.getAttribute("href"))!;
      expect(href).toContain(`class=${class6.id}`);
      const xlsx = await page.request.get(href);
      expect(xlsx.status()).toBe(200);
      expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");

      // 7. Today's collection shows both receipts.
      await page
        .getByRole("link", { name: d.fees.reports.daily.title, exact: true })
        .first()
        .click();
      await expect(page).toHaveURL(/report=daily/);
      const daily = page.getByTestId("report");
      for (const no of [firstNo, secondNo])
        await expect(
          daily.getByRole("row").filter({ hasText: no }),
        ).toContainText(payerName);
      const dailyXlsx = await page.request.get(
        (await excel.getAttribute("href"))!,
      );
      expect(dailyXlsx.status()).toBe(200);
      expect(dailyXlsx.headers()["content-type"]).toContain("spreadsheetml");
    } finally {
      await cleanupFees(code);
    }
  });
}

// ---------------------------------------------------------------- Website editor

/** Fills the English and Bangla titles of a content form. */
async function fillTitles(
  page: Page,
  d: typeof en | typeof bn,
  titleEn: string,
  titleBn: string,
) {
  await page
    .getByRole("tabpanel", { name: d.cms.english })
    .getByLabel(d.contentAdmin.fields.title, { exact: true })
    .fill(titleEn);
  await page.getByRole("tab", { name: d.cms.bangla }).click();
  await page
    .getByRole("tabpanel", { name: d.cms.bangla })
    .getByLabel(d.contentAdmin.fields.title, { exact: true })
    .fill(titleBn);
  await page.getByRole("tab", { name: d.cms.english }).click();
}

const idFromUrl = (page: Page) => Number(page.url().split("/").pop());

async function cleanupContent(ids: {
  notice: number | null;
  page: number | null;
  album: number | null;
}) {
  const db = adminClient();
  if (ids.notice) await db.from("notices").delete().eq("id", ids.notice);
  if (ids.page) await db.from("pages").delete().eq("id", ids.page);
  if (ids.album) {
    const { data: photos } = await db
      .from("gallery_images")
      .select("image_path")
      .eq("album_id", ids.album);
    const { data: album } = await db
      .from("gallery_albums")
      .select("cover_path")
      .eq("id", ids.album)
      .maybeSingle();
    const paths = [
      ...(photos ?? []).map((p) => p.image_path),
      album?.cover_path,
    ].filter((p): p is string => typeof p === "string" && p.length > 0);
    await db.from("gallery_albums").delete().eq("id", ids.album);
    if (paths.length)
      await db.storage.from("public-media").remove([...new Set(paths)]);
  }
}

for (const lang of LANGS) {
  test(`website editor (${lang}): notice, CMS page and gallery album go live`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const d = dictFor(lang);
    const num = (v: number | string) => localizeDigits(v, lang);
    const id = `${uid()}${Math.round(Math.random() * 1e3)}`;
    const ids = {
      notice: null as number | null,
      page: null as number | null,
      album: null as number | null,
    };
    try {
      await loginAs(page, "admin@sunrise.test");

      // 1. A notice, published straight away.
      const notice = {
        en: `E2E day notice ${id}`,
        bn: `ই২ই দিনের নোটিশ ${id}`,
      };
      await page.goto(`/${lang}/dashboard/notices/new`);
      await fillTitles(page, d, notice.en, notice.bn);
      await page
        .getByLabel(d.contentAdmin.fields.category, { exact: true })
        .selectOption({ label: d.content.categories.exam });
      await page
        .getByLabel(d.contentAdmin.fields.isPublished, { exact: true })
        .check();
      await page
        .getByRole("button", { name: d.contentAdmin.save, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/dashboard/notices/\\d+$`),
      );
      ids.notice = idFromUrl(page);
      const noticeSlug = await page
        .getByLabel(d.contentAdmin.fields.slug, { exact: true })
        .inputValue();

      await page.goto(`/${lang}`);
      await expect(
        page
          .getByRole("region", { name: d.site.home.noticeBoard })
          .getByRole("link", { name: notice[lang] })
          .first(),
      ).toBeAttached();
      await page.goto(
        `/${lang}/notices?category=exam&q=${encodeURIComponent(notice[lang])}`,
      );
      await page.getByRole("link", { name: notice[lang] }).first().click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/notices/${noticeSlug}$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        notice[lang],
      );

      // 2. A CMS page: saved as a draft, then edited and published.
      const slug = `e2e-day-${id}`;
      const pg = {
        en: `E2E day page ${id}`,
        bn: `ই২ই দিনের পেজ ${id}`,
        bodyEn: `Library opens at nine ${id}`,
        bodyBn: `গ্রন্থাগার নয়টায় খোলে ${id}`,
      };
      await page.goto(`/${lang}/dashboard/pages/new`);
      const enPanel = page.getByRole("tabpanel", { name: d.cms.english });
      await enPanel
        .getByRole("textbox", { name: d.cms.titleField, exact: true })
        .fill(`${pg.en} draft`);
      await page.getByLabel(d.cms.slugField, { exact: true }).fill(slug);
      await enPanel.getByRole("textbox", { name: d.cms.bodyField }).click();
      await page.keyboard.type("Draft text");
      await page.getByRole("button", { name: d.cms.save, exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/dashboard/pages/\\d+$`),
      );
      ids.page = idFromUrl(page);
      expect((await page.request.get(`/${lang}/p/${slug}`)).status()).toBe(404);

      await enPanel
        .getByRole("textbox", { name: d.cms.titleField, exact: true })
        .fill(pg.en);
      await enPanel.getByRole("textbox", { name: d.cms.bodyField }).click();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type(pg.bodyEn);
      await page.getByRole("tab", { name: d.cms.bangla }).click();
      const bnPanel = page.getByRole("tabpanel", { name: d.cms.bangla });
      await bnPanel
        .getByRole("textbox", { name: d.cms.titleField, exact: true })
        .fill(pg.bn);
      await bnPanel.getByRole("textbox", { name: d.cms.bodyField }).click();
      await page.keyboard.type(pg.bodyBn);
      await page.getByLabel(d.cms.publish, { exact: true }).check();
      await page.getByRole("button", { name: d.cms.save, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: d.cms.saved }),
      ).toBeVisible();

      await page.goto(`/${lang}/p/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        pg[lang],
      );
      await expect(page.locator("article")).toContainText(
        lang === "en" ? pg.bodyEn : pg.bodyBn,
      );
      await expect(page.locator("article")).not.toContainText("Draft text");

      // 3. A gallery album with one photo.
      const album = {
        en: `E2E day album ${id}`,
        bn: `ই২ই দিনের অ্যালবাম ${id}`,
      };
      await page.goto(`/${lang}/dashboard/gallery/new`);
      await fillTitles(page, d, album.en, album.bn);
      await page
        .getByLabel(d.contentAdmin.fields.eventDate, { exact: true })
        .fill(new Date().toISOString().slice(0, 10));
      await page
        .getByLabel(d.contentAdmin.fields.isPublished, { exact: true })
        .check();
      await page
        .getByRole("button", { name: d.contentAdmin.save, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/dashboard/gallery/\\d+$`),
      );
      ids.album = idFromUrl(page);
      const albumSlug = await page
        .getByLabel(d.contentAdmin.fields.slug, { exact: true })
        .inputValue();
      await page
        .getByLabel(d.contentAdmin.addPhotos, { exact: true })
        .setInputFiles([
          { name: "day.png", mimeType: "image/png", buffer: TINY_PNG },
        ]);
      await expect(
        page.getByText(fill(d.contentAdmin.uploadedN, { count: num(1) })),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: d.contentAdmin.removePhoto }),
      ).toHaveCount(1);

      await page.goto(`/${lang}/gallery`);
      await page.getByRole("link", { name: album[lang], exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`/${lang}/gallery/${albumSlug}$`),
      );
      const photo = page.getByRole("button", {
        name: fill(d.content.openPhoto, {
          caption: fill(d.content.photoOf, { n: num(1), total: num(1) }),
        }),
        exact: true,
      });
      await expect(photo).toBeVisible();
      await expect(photo.locator("img")).toHaveAttribute("src", /.+/);
    } finally {
      await cleanupContent(ids);
    }
  });
}
