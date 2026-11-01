import { expect, test } from "@playwright/test";

import { formatDate, localizeDigits } from "@/lib/format";

import { adminClient, cleanupApplication } from "./helpers";

// Step 6.2 (NFR-02): crawl the whole public website and assert that no personal data
// of staff, students or guardians appears: NID, birth date, birth registration number,
// address, personal or guardian phone. Values come from the database (demo seed).

const MAX_PAGES = 400;

/** Every private value, as it could be printed (as stored, Bangla digits, dates formatted). */
async function privateValues(): Promise<string[]> {
  const db = adminClient();
  const [staff, students, guardians, profiles, applications] =
    await Promise.all([
      db
        .from("staff_private")
        .select("nid, birth_date, address, personal_phone, email"),
      db
        .from("students")
        .select("birth_date, birth_reg_no, address, personal_phone"),
      db.from("guardians").select("phone, nid, address, email"),
      db.from("profiles").select("phone"),
      db
        .from("admission_applications")
        .select(
          "birth_date, birth_reg_no, guardian_phone, guardian_email, present_address, permanent_address",
        ),
    ]);
  const raw = new Set<string>();
  const dates = new Set<string>();
  const add = (values: (string | null)[], date?: string | null) => {
    for (const v of values) if (v) raw.add(v);
    if (date) dates.add(date);
  };
  for (const r of staff.data ?? [])
    add([r.nid, r.address, r.personal_phone, r.email], r.birth_date);
  for (const r of students.data ?? [])
    add([r.birth_reg_no, r.address, r.personal_phone], r.birth_date);
  for (const r of guardians.data ?? [])
    add([r.phone, r.nid, r.address, r.email]);
  for (const r of profiles.data ?? []) add([r.phone]);
  for (const r of applications.data ?? [])
    add(
      [
        r.birth_reg_no,
        r.guardian_phone,
        r.guardian_email,
        r.present_address,
        r.permanent_address,
      ],
      r.birth_date,
    );
  // Each kind of record contributes, so an empty table cannot pass the crawl by accident.
  expect(staff.data?.length, "staff").toBeGreaterThan(3);
  expect(
    (students.data ?? []).filter((r) => r.personal_phone).length,
    "a student with a personal phone",
  ).toBeGreaterThan(0);
  expect(guardians.data?.length, "guardians").toBeGreaterThan(3);
  expect(applications.data?.length, "applications").toBeGreaterThan(0);
  const out = new Set<string>();
  for (const v of raw) {
    if (v.trim().length < 6) continue; // too short to be meaningful
    out.add(v);
    out.add(localizeDigits(v, "bn"));
  }
  for (const d of dates)
    for (const lang of ["en", "bn"] as const) {
      out.add(localizeDigits(d, lang));
      for (const style of ["short", "medium", "long"] as const)
        out.add(formatDate(d, lang, style));
    }
  return [...out];
}

/** Page text as a reader sees it: entities decoded, so an escaped value is still found. */
function decode(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Pages reached only through forms or scripts: a published mark sheet, a certificate. */
async function deepLinks(lang: string): Promise<string[]> {
  const db = adminClient();
  const [{ data: exam }, { data: cert }] = await Promise.all([
    db
      .from("exams")
      .select("id, session_id, exam_classes(class_id)")
      .eq("status", "published")
      .order("id")
      .limit(1)
      .maybeSingle(),
    db
      .from("certificates")
      .select("reference")
      .order("id")
      .limit(1)
      .maybeSingle(),
  ]);
  const out: string[] = [];
  if (exam) {
    const classId = (exam.exam_classes as { class_id: number }[])[0]?.class_id;
    const { data: section } = await db
      .from("sections")
      .select("id, class_id")
      .eq("class_id", classId ?? 0)
      .order("id")
      .limit(1)
      .maybeSingle();
    const { data: enrolled } = await db
      .from("enrollments")
      .select("roll, group_id")
      .eq("session_id", exam.session_id)
      .eq("section_id", section?.id ?? 0)
      .order("roll")
      .limit(1)
      .maybeSingle();
    if (section && enrolled)
      out.push(
        `/${lang}/result?session=${exam.session_id}&exam=${exam.id}&class=${section.class_id}&section=${section.id}&group=${enrolled.group_id ?? ""}&roll=${enrolled.roll}`,
      );
  }
  if (cert) out.push(`/${lang}/verify/${cert.reference}`);
  return out;
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

const APPLICANT_PHONE = "01999000777";

/** The demo seed has no applications; one is made for the crawl and removed after it. */
async function withApplication<T>(run: () => Promise<T>): Promise<T> {
  const db = adminClient();
  const { data: session } = await db
    .from("academic_sessions")
    .select("id")
    .eq("is_current", true)
    .single();
  await cleanupApplication(APPLICANT_PHONE);
  const { error } = await db.from("admission_applications").insert({
    tracking_no: `ADM-2026-${Date.now() % 100000000}`,
    session_id: session!.id,
    class_id: 1,
    student_name_en: "Crawl Applicant",
    birth_date: "2013-07-19",
    gender: "female",
    birth_reg_no: "20137771234567890",
    father_name: "Crawl Father",
    mother_name: "Crawl Mother",
    guardian_phone: APPLICANT_PHONE,
    guardian_email: "crawl-family@example.net",
    present_address: "House 77, Crawl Road, Demo Upazila",
    permanent_address: "Village Crawlpur, Demo Upazila",
  });
  if (error) throw new Error(`application: ${error.message}`);
  try {
    return await run();
  } finally {
    await cleanupApplication(APPLICANT_PHONE);
  }
}

for (const lang of ["en", "bn"] as const) {
  test(`no personal data on any public page (${lang})`, async ({
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "server HTML only");
    test.setTimeout(300_000);
    await withApplication(async () => {
      const secrets = await privateValues();
      expect(secrets.length).toBeGreaterThan(60);
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
        ...(await deepLinks(lang)),
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
        const text = decode(html);
        for (const s of secrets)
          if (text.includes(s)) leaks.push(`${url}: ${s}`);
        for (const next of links(html, lang))
          if (!seen.has(next)) queue.push(next);
      }
      // The crawl reached the people pages, where private data would most likely leak.
      expect([...seen].some((u) => /\/teachers\/[^/]+$/.test(u))).toBe(true);
      expect([...seen].some((u) => /\/result\?.*roll=/.test(u))).toBe(true);
      expect([...seen].some((u) => /\/verify\/[^/]+$/.test(u))).toBe(true);
      expect(seen.size).toBeGreaterThan(80);
      expect(leaks).toEqual([]);
    });
  });
}
