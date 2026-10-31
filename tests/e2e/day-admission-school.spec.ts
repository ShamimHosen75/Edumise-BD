import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import bn from "@/dictionaries/bn.json" with { type: "json" };
import en from "@/dictionaries/en.json" with { type: "json" };
import { localizeDigits } from "@/lib/format";

import { adminClient, loginAs } from "./helpers";

// Step 6.1 "day in the life" scenarios: admission season and a school day (attendance),
// each in English and Bangla. Every label comes from the dictionaries.

type Lang = "en" | "bn";
type Named = { name_en: string; name_bn: string };

const db = () => adminClient();
const PHOTO = path.join(process.cwd(), "public/demo/head-teacher.jpg");
const PDF = path.join(process.cwd(), "public/demo/notice-sample.pdf");
/** Any digit, Latin or Bangla. */
const DIGIT = "[0-9০-৯]";
/** A made-up client address, so each test has its own admission rate limit. */
const fakeIp = () =>
  `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
const dhakaToday = () =>
  new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Fills {placeholders} the way the app's t() does. */
const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
/** A regex for a dictionary template; placeholders become the given patterns. */
const pattern = (tpl: string, parts: Record<string, string>) =>
  new RegExp(
    esc(tpl).replace(/\\\{(\w+)\\\}/g, (m, k: string) => parts[k] ?? m),
  );
const pick = (row: Named, lang: Lang) =>
  (lang === "bn" && row.name_bn.trim()) || row.name_en;

/** Signs out by dropping the session cookies, then logs in as someone else. */
async function switchUser(page: Page, email: string) {
  await page.context().clearCookies();
  await loginAs(page, email);
}

async function sectionByName(level: number, name: string) {
  const { data, error } = await db()
    .from("sections")
    .select(
      "id, name_en, name_bn, class:classes!inner(id, level, name_en, name_bn)",
    )
    .eq("name_en", name)
    .eq("class.level", level)
    .single();
  if (error) throw error;
  return data as unknown as Named & {
    id: number;
    class: Named & { id: number };
  };
}

// ---------------------------------------------------------------------------
// 1. Admission season
// ---------------------------------------------------------------------------

async function cleanupApplication(phone: string) {
  const admin = db();
  const { data: apps } = await admin
    .from("admission_applications")
    .select("id, student_id, photo_path, admission_documents(file_path)")
    .eq("guardian_phone", phone);
  for (const app of apps ?? []) {
    const files = [
      app.photo_path,
      ...((app.admission_documents ?? []) as { file_path: string }[]).map(
        (x) => x.file_path,
      ),
    ].filter((f): f is string => Boolean(f));
    if (app.student_id) {
      const { data: links } = await admin
        .from("student_guardians")
        .select("guardian_id")
        .eq("student_id", app.student_id);
      const guardianIds = (links ?? []).map((l) => l.guardian_id);
      const { data: guardians } = guardianIds.length
        ? await admin
            .from("guardians")
            .select("id, profile_id")
            .in("id", guardianIds)
        : { data: [] };
      // Enrolments, guardian links and attendance go with the student (cascade).
      await admin.from("students").delete().eq("id", app.student_id);
      if (guardianIds.length)
        await admin.from("guardians").delete().in("id", guardianIds);
      for (const g of guardians ?? [])
        if (g.profile_id) await admin.auth.admin.deleteUser(g.profile_id);
    }
    await admin.from("admission_applications").delete().eq("id", app.id);
    if (files.length) await admin.storage.from("private-docs").remove(files);
  }
}

async function fillApplication(
  page: Page,
  lang: Lang,
  o: { name: string; phone: string; birthReg: string; className: string },
) {
  const d = lang === "en" ? en : bn;
  const f = d.admission.fields;
  const next = () =>
    page.getByRole("button", { name: d.admission.next, exact: true }).click();
  const step = (n: number) =>
    expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(n),
    );

  await step(1);
  await page.getByLabel(f.studentNameEn).fill(o.name);
  await page.getByLabel(f.birthDate).fill("2014-03-15");
  await page
    .getByLabel(f.gender)
    .selectOption({ label: d.admission.genders.female });
  await page.getByLabel(f.birthRegNo).fill(o.birthReg);
  await page.getByLabel(f.photo).setInputFiles(PHOTO);
  await expect(page.getByText("✓ photo.jpg")).toBeVisible();
  await next();

  await step(2);
  await page.getByLabel(f.fatherName).fill(`${o.name} Father`);
  await page.getByLabel(f.motherName).fill(`${o.name} Mother`);
  await page.getByLabel(f.phone).fill(o.phone);
  await page.getByLabel(f.presentAddress).fill("12 School Road, Demo Town");
  await next();

  await step(3);
  await page.getByLabel(f.class).selectOption({ label: o.className });
  await page.getByLabel(f.previousSchool).fill("Demo Primary School");
  await next();

  await step(4);
  await page.getByLabel(f.birthCertificate).setInputFiles(PDF);
  await page.getByLabel(f.transcript).setInputFiles(PDF);
  await next();

  await step(5);
  await expect(page.getByRole("main")).toContainText(o.name);
  await page.getByLabel(f.declaration).check();
}

async function checkStatus(
  page: Page,
  lang: Lang,
  tracking: string,
  phone: string,
) {
  const d = lang === "en" ? en : bn;
  await page.goto(`/${lang}/admission/status`);
  await page.getByLabel(d.admission.fields.trackingNo).fill(tracking);
  await page.getByLabel(d.admission.fields.phoneLookup).fill(phone);
  await page.getByRole("button", { name: d.admission.lookup }).click();
  return page.getByTestId("admission-status");
}

for (const lang of ["en", "bn"] as const) {
  test(`admission season (${lang})`, async ({ page }) => {
    test.setTimeout(240_000);
    const d = lang === "en" ? en : bn;
    const n = (v: string | number) => localizeDigits(v, lang);
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
    const id = `${Date.now()}`.slice(-8);
    const name = `E2E Day ${lang.toUpperCase()} ${id}`;
    const phone = `017${id}`;
    const birthReg = `2014${id}12345`.slice(0, 17);
    const target = await sectionByName(6, "B");
    const className = pick(target.class, lang);
    const sectionName = pick(target, lang);
    const sectionLabel = `${className} ${sectionName}`;

    try {
      // A visitor applies online through the five steps.
      await page.goto(`/${lang}/admission/apply`);
      await expect(
        page.getByRole("heading", { name: d.admission.applyTitle }),
      ).toBeVisible();
      await fillApplication(page, lang, { name, phone, birthReg, className });
      await page.getByRole("button", { name: d.admission.submit }).click();
      await expect(
        page.getByRole("heading", { name: d.admission.successTitle }),
      ).toBeVisible({ timeout: 30_000 });
      const tracking = (await page
        .getByTestId("tracking-no")
        .textContent())!.trim();
      expect(tracking).toMatch(new RegExp(`^ADM-${DIGIT}{4}-${DIGIT}{5}$`));
      await expect(page.getByText(d.admission.documentMissing)).toHaveCount(0);

      // The family checks the status with the tracking number and mobile.
      await expect(await checkStatus(page, lang, tracking, phone)).toHaveText(
        d.admission.statuses.submitted,
      );

      // The office finds the application, schedules the test, enters marks, approves.
      await loginAs(page, "admin@sunrise.test");
      await page.goto(`/${lang}/dashboard/admissions`);
      await page.getByLabel(d.table.search).fill(tracking);
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page.getByRole("main")).toContainText(tracking);
      const aa = d.admissionsAdmin;
      await page
        .getByLabel(aa.status, { exact: true })
        .selectOption("test_scheduled");
      await page.getByLabel(aa.testAt).fill("2026-12-05T10:00");
      await page.getByLabel(aa.testVenue).fill("Room 101");
      await page.getByLabel(aa.marks).fill("87.5");
      await page.getByRole("button", { name: aa.saveReview }).click();
      await expect(
        page.getByText(aa.saved, { exact: true }).last(),
      ).toBeVisible();
      await expect(page.getByTestId("application-status")).toHaveText(
        d.admission.statuses.test_scheduled,
      );
      await page
        .getByLabel(aa.section, { exact: true })
        .selectOption({ label: sectionLabel });
      page.once("dialog", (dialog) => void dialog.accept());
      await page
        .getByRole("button", { name: aa.approveButton, exact: true })
        .click();
      await expect(
        page.getByText(
          pattern(aa.approved, {
            name: esc(name),
            code: `${DIGIT}{10}`,
            roll: `${DIGIT}+`,
          }),
        ),
      ).toBeVisible({ timeout: 30_000 });

      // The guardian login made on approval is shown once.
      await expect(
        page.getByText(fill(aa.guardianLoginIntro, { phone: n(phone) })),
      ).toBeVisible();
      await expect(page.getByTestId("guardian-password")).toHaveText(
        /^[A-Za-z2-9]{12}$/,
      );

      // The new student is in the class list of that section.
      const { data: app } = await db()
        .from("admission_applications")
        .select(
          "student_id, student:students(student_code, enrollments(roll, section_id))",
        )
        .eq("guardian_phone", phone)
        .single();
      const student = app!.student as unknown as {
        student_code: string;
        enrollments: { roll: number; section_id: number }[];
      };
      expect(student.enrollments).toEqual([
        expect.objectContaining({ section_id: target.id }),
      ]);
      await page.goto(`/${lang}/dashboard/students`);
      await page
        .getByLabel(d.students.class, { exact: true })
        .selectOption({ label: className });
      await page
        .getByLabel(d.students.section, { exact: true })
        .selectOption({ label: sectionName });
      const row = page.getByRole("row", { name: new RegExp(esc(name)) });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(n(student.student_code));
      await expect(row).toContainText(n(phone));
      await expect(row.getByRole("cell").nth(1)).toHaveText(sectionName);
      await expect(row.getByRole("cell").nth(2)).toHaveText(
        n(student.enrollments[0]!.roll),
      );

      // The status page now says approved.
      await page.context().clearCookies();
      await expect(await checkStatus(page, lang, tracking, phone)).toHaveText(
        d.admission.statuses.approved,
      );
    } finally {
      await cleanupApplication(phone);
    }
  });
}

// ---------------------------------------------------------------------------
// 2. A school day: attendance
// ---------------------------------------------------------------------------

/** Each language uses one of the guardian's children: Rahim (6 A) or Karim (9 A). */
const CHILD: Record<Lang, number> = { en: 1, bn: 11 };

async function childInTeacherSection(studentId: number) {
  const admin = db();
  const [{ data: student }, { data: session }, { data: teacher }] =
    await Promise.all([
      admin
        .from("students")
        .select("full_name_en, full_name_bn")
        .eq("id", studentId)
        .single(),
      admin
        .from("academic_sessions")
        .select("id")
        .eq("is_current", true)
        .single(),
      admin
        .from("staff")
        .select("id, profile:profiles!inner(email)")
        .eq("profile.email", "teacher@sunrise.test")
        .single(),
    ]);
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("roll, section_id")
    .eq("student_id", studentId)
    .eq("session_id", session!.id)
    .single();
  const { count: teaches } = await admin
    .from("teacher_assignments")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", teacher!.id)
    .eq("session_id", session!.id)
    .eq("section_id", enrollment!.section_id);
  expect(teaches, "the teacher teaches the child's section").toBeGreaterThan(0);
  const { data: section } = await admin
    .from("sections")
    .select("id, name_en, name_bn, class:classes(id, name_en, name_bn)")
    .eq("id", enrollment!.section_id)
    .single();
  const { data: roster } = await admin
    .from("enrollments")
    .select("student_id, roll")
    .eq("session_id", session!.id)
    .eq("section_id", enrollment!.section_id)
    .order("roll");
  return {
    sessionId: session!.id as number,
    student: student as Named & { full_name_en: string; full_name_bn: string },
    roll: enrollment!.roll as number,
    section: section as unknown as Named & {
      id: number;
      class: Named & { id: number };
    },
    roster: roster ?? [],
  };
}

/** Today's numbers for one class, as the admin widget counts them. */
async function classToday(sessionId: number, classId: number, date: string) {
  const admin = db();
  const { data: sections } = await admin
    .from("sections")
    .select("id")
    .eq("class_id", classId);
  const ids = (sections ?? []).map((s) => s.id);
  const [{ count: enrolled }, { data: marks }] = await Promise.all([
    admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .in("section_id", ids),
    admin
      .from("attendance")
      .select("status")
      .eq("date", date)
      .in("section_id", ids),
  ]);
  const all = marks ?? [];
  const counted = all.filter((m) => m.status !== "leave").length;
  const attended = all.filter(
    (m) => m.status === "present" || m.status === "late",
  ).length;
  return {
    enrolled: enrolled ?? 0,
    marked: all.length,
    percent: counted ? Math.round((attended / counted) * 100) : null,
  };
}

async function isSchoolDay(date: string) {
  const [{ data: settings }, { data: holidays }] = await Promise.all([
    db().from("school_settings").select("working_days").single(),
    db().from("holidays").select("starts_on, ends_on"),
  ]);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (
    (settings!.working_days as number[]).includes(weekday) &&
    !(holidays ?? []).some((h) => h.starts_on <= date && date <= h.ends_on)
  );
}

for (const lang of ["en", "bn"] as const) {
  test(`a school day: attendance (${lang})`, async ({ page }) => {
    test.setTimeout(180_000);
    const d = lang === "en" ? en : bn;
    const a = d.attendance;
    const n = (v: string | number) => localizeDigits(v, lang);
    const today = dhakaToday();
    test.skip(!(await isSchoolDay(today)), "the school is closed today");

    const ctx = await childInTeacherSection(CHILD[lang]);
    const childName = pick(
      { name_en: ctx.student.full_name_en, name_bn: ctx.student.full_name_bn },
      lang,
    );
    const className = pick(ctx.section.class, lang);
    const sectionLabel = `${className} ${pick(ctx.section, lang)}`;
    const other = ctx.roster.find((r) => r.student_id !== CHILD[lang])!;
    const { data: otherStudent } = await db()
      .from("students")
      .select("full_name_en, full_name_bn")
      .eq("id", other.student_id)
      .single();
    const otherName = pick(
      {
        name_en: otherStudent!.full_name_en,
        name_bn: otherStudent!.full_name_bn,
      },
      lang,
    );
    // Keep whatever was saved for this section today, and put it back afterwards.
    const { data: before } = await db()
      .from("attendance")
      .select("student_id, section_id, date, status, note, marked_by")
      .eq("section_id", ctx.section.id)
      .eq("date", today);

    try {
      // Morning: the teacher marks the class on the phone-friendly page.
      await loginAs(page, "teacher@sunrise.test");
      await page.goto(
        `/${lang}/dashboard/attendance?section=${ctx.section.id}&date=${today}`,
      );
      await expect(page.getByLabel(a.section, { exact: true })).toHaveValue(
        String(ctx.section.id),
      );
      const students = page.getByTestId("attendance-student");
      await expect(students).toHaveCount(ctx.roster.length);
      await page.getByRole("button", { name: a.allPresent }).click();
      const button = (who: string, roll: number, status: string) =>
        page.getByRole("button", {
          name: fill(a.studentStatus, { name: who, roll: n(roll), status }),
          exact: true,
        });
      // The child is absent; another student comes late (Present -> Absent -> Late).
      await button(childName, ctx.roll, a.statuses.present).click();
      await expect(
        button(childName, ctx.roll, a.statuses.absent),
      ).toBeVisible();
      await button(otherName, other.roll, a.statuses.present).click();
      await button(otherName, other.roll, a.statuses.absent).click();
      await expect(
        button(otherName, other.roll, a.statuses.late),
      ).toBeVisible();
      await expect(page.getByTestId("attendance-counts")).toContainText(
        fill(a.counts, {
          present: n(ctx.roster.length - 2),
          absent: n(1),
          late: n(1),
          leave: n(0),
        }),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await page.getByRole("button", { name: a.save }).click();
      await expect(page.getByText(a.saved).last()).toBeVisible();
      await page.reload();
      await expect(
        button(childName, ctx.roll, a.statuses.absent),
      ).toBeVisible();
      await expect(
        button(otherName, other.roll, a.statuses.late),
      ).toBeVisible();

      // The office: the home widget counts the section, the monthly sheet shows the marks.
      const expected = await classToday(
        ctx.sessionId,
        ctx.section.class.id,
        today,
      );
      expect(expected.marked).toBeGreaterThanOrEqual(ctx.roster.length);
      await switchUser(page, "admin@sunrise.test");
      await page.goto(`/${lang}/dashboard/admin`);
      const widget = page.getByTestId("attendance-today");
      await expect(
        widget.getByRole("heading", { name: a.today }),
      ).toBeVisible();
      const card = widget
        .locator("ul")
        .first()
        .getByRole("listitem")
        .filter({ has: page.getByText(className, { exact: true }) });
      await expect(card).toContainText(
        fill(a.marked, {
          marked: n(expected.marked),
          total: n(expected.enrolled),
        }),
      );
      await expect(card).toContainText(
        expected.percent === null ? a.noPercent : `${n(expected.percent)}%`,
      );
      await expect(
        widget.getByRole("link", { name: sectionLabel, exact: true }),
      ).toHaveCount(0);

      await page.goto(
        `/${lang}/dashboard/attendance/sheet?section=${ctx.section.id}&month=${today.slice(0, 7)}`,
      );
      const day = Number(today.slice(8));
      // Cells: roll, then one per day (the name is the row header).
      const childRow = page.getByRole("row", {
        name: new RegExp(esc(childName)),
      });
      await expect(childRow.getByRole("cell").nth(day)).toHaveText(
        a.codes.absent,
      );
      const otherRow = page.getByRole("row", {
        name: new RegExp(esc(otherName)),
      });
      await expect(otherRow.getByRole("cell").nth(day)).toHaveText(
        a.codes.late,
      );

      // Evening: the guardian sees today's absence on the child's calendar.
      await switchUser(page, "guardian@sunrise.test");
      await page.goto(`/${lang}/dashboard/my-children`);
      await page
        .getByTestId("portal-student")
        .filter({ hasText: childName })
        .getByRole("link", { name: a.viewSheet, exact: true })
        .click();
      await page.waitForURL(/\/my-children\/\d+\/attendance$/);
      expect(page.url()).toContain(
        `/${lang}/dashboard/my-children/${CHILD[lang]}/`,
      );
      await expect(
        page.getByRole("cell", {
          name: new RegExp(`^${esc(n(day))}\\s*${esc(a.statuses.absent)}$`),
        }),
      ).toBeVisible();
      await expect(page.getByTestId("attendance-summary")).toContainText(
        pattern(a.monthCounts, {
          present: `${DIGIT}+`,
          late: `${DIGIT}+`,
          absent: `[1-9১-৯]${DIGIT}*`,
          leave: `${DIGIT}+`,
          days: `${DIGIT}+`,
        }),
      );
    } finally {
      await db()
        .from("attendance")
        .delete()
        .eq("section_id", ctx.section.id)
        .eq("date", today);
      if (before?.length) await db().from("attendance").insert(before);
    }
  });
}
