import { expect, test } from "@playwright/test";

import { formatDate, localizeDigits } from "@/lib/format";

import { adminClient } from "./helpers";

// Step 6.2 (NFR-02): crawl the whole public website and assert that no personal data
// of staff, students or guardians appears: NID, birth date, birth registration number,
// address, personal or guardian phone. Values come from the database (demo seed).

const MAX_PAGES = 400;

/** Every private value, as it could be printed (as stored, Bangla digits, dates formatted). */
async function privateValues(): Promise<string[]> {
  const db = adminClient();
  const [staff, students, guardians] = await Promise.all([
    db.from("staff_private").select("nid, birth_date, address, personal_phone"),
    db
      .from("students")
      .select("birth_date, birth_reg_no, address, personal_phone"),
    db.from("guardians").select("phone, nid, address"),
  ]);
  const raw = new Set<string>();
  const dates = new Set<string>();
  for (const r of staff.data ?? []) {
    [r.nid, r.address, r.personal_phone].forEach((v) => v && raw.add(v));
    if (r.birth_date) dates.add(r.birth_date);
  }
  for (const r of students.data ?? []) {
    [r.birth_reg_no, r.address, r.personal_phone].forEach(
      (v) => v && raw.add(v),
    );
    if (r.birth_date) dates.add(r.birth_date);
  }
  for (const r of guardians.data ?? [])
    [r.phone, r.nid, r.address].forEach((v) => v && raw.add(v));
  const out = new Set<string>();
  for (const v of raw) {
    if (v.trim().length < 6) continue; // too short to be meaningful
    out.add(v);
    out.add(localizeDigits(v, "bn"));
  }
  for (const d of dates)
    for (const lang of ["en", "bn"] as const) {
      out.add(localizeDigits(d, lang));
      for (const style of ["medium", "long"] as const)
        out.add(formatDate(d, lang, style));
    }
  return [...out];
}

/** Same-site public links in a page (no dashboard, sign-in, API or files). */
function links(html: string, lang: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/href="(\/[^"#?]*)(\?[^"#]*)?"/g)) {
    const path = m[1]!;
    if (
      path.startsWith(`/${lang}`) &&
      !/\/(dashboard|login|forgot-password|reset-password|change-password)(\/|$)/.test(
        path,
      ) &&
      !/\.(pdf|png|jpe?g|webp|xlsx|csv)$/i.test(path) &&
      // A calendar month lists every date of the month; walking back years would
      // "find" birth dates as plain calendar days. This year's months are enough.
      !(
        path.endsWith("/calendar") &&
        (m[2] ?? "").includes("month=") &&
        !(m[2] ?? "").includes(`month=${new Date().getFullYear()}`)
      )
    )
      found.add(path + (m[2] ?? "").replace(/&amp;/g, "&"));
  }
  return [...found];
}

for (const lang of ["en", "bn"] as const) {
  test(`no personal data on any public page (${lang})`, async ({
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "server HTML only");
    test.setTimeout(300_000);
    const secrets = await privateValues();
    expect(secrets.length).toBeGreaterThan(20);
    // Start from every page in the sitemap (header menus build their links only when
    // opened) plus the pages that take a form.
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const queue = [
      ...[...sitemap.matchAll(/<loc>[^<]*?(\/[a-z]{2}(?:\/[^<]*)?)<\/loc>/g)]
        .map((m) => m[1]!)
        .filter((u) => u === `/${lang}` || u.startsWith(`/${lang}/`)),
      ...[
        "teachers",
        "teachers?status=former",
        "governing-body",
        "ex-principals",
        "contact",
        "admission/apply",
        "admission/status",
        "result",
        "board-results",
        "routine",
        "exam-routine",
        "calendar",
        "verify",
      ].map((p) => `/${lang}/${p}`),
    ];
    const seen = new Set<string>();
    const leaks: string[] = [];
    while (queue.length && seen.size < MAX_PAGES) {
      const url = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);
      const res = await request.get(url, { failOnStatusCode: false });
      if (!(res.headers()["content-type"] ?? "").includes("text/html"))
        continue;
      const html = await res.text();
      for (const s of secrets) if (html.includes(s)) leaks.push(`${url}: ${s}`);
      for (const next of links(html, lang))
        if (!seen.has(next)) queue.push(next);
    }
    // The crawl reached the people pages, where private data would most likely leak.
    expect([...seen].some((u) => /\/teachers\/[^/]+$/.test(u))).toBe(true);
    expect(seen.size).toBeGreaterThan(80);
    expect(leaks).toEqual([]);
  });
}
