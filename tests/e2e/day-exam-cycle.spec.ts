import { expect, test, type Page } from "@playwright/test";

import bn from "@/dictionaries/bn.json" with { type: "json" };
import en from "@/dictionaries/en.json" with { type: "json" };

import {
  formatNumber,
  localizeDigits,
  toBanglaDigits,
} from "../../src/lib/format";

import { adminClient, loginAs } from "./helpers";

/**
 * Day in the life (Step 6.1): the exam cycle. The office sets up an exam for Class 9,
 * the maths teacher enters and locks 9A's marks, the office processes, reviews and
 * publishes, a visitor finds Karim's mark sheet on the website and his guardian sees it
 * in the portal. Runs in English and Bangla (and on desktop and 360px via the projects).
 */

type Lang = "en" | "bn";
type Named = { name_en: string; name_bn: string };

const fmt = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));
/** A dictionary text with {count} as any number (Latin or Bangla digits). */
const anyCount = (text: string) =>
  new RegExp(
    `^${text
      .replace(/[.*+?^$()|[\]\\]/g, "\\$&")
      .replace("{count}", "[0-9০-৯]+")}$`,
  );
const KARIM = 11; // 9A roll 1, Science group, Higher Maths as 4th subject; guardian's child.

/** Everything the scenario needs from the seeded school, read with the service role. */
async function loadSchool() {
  const db = adminClient();
  const { data: session } = await db
    .from("academic_sessions")
    .select("id, name")
    .eq("is_current", true)
    .single();
  const { data: cls } = await db
    .from("classes")
    .select("id, name_en, name_bn, sections(id, name_en, name_bn)")
    .eq("level", 9)
    .single();
  const sections = cls!.sections as (Named & { id: number })[];
  const { data: pupils } = await db
    .from("enrollments")
    .select(
      "student_id, section_id, roll, group_id, student:students!inner(full_name_en, full_name_bn, status), group:groups(name_en, name_bn)",
    )
    .eq("session_id", session!.id)
    .in(
      "section_id",
      sections.map((s) => s.id),
    )
    .not("student.status", "in", "(transferred,inactive)")
    .order("roll");
  const { data: taught } = await db
    .from("class_subjects")
    .select("subject_id, group_id")
    .eq("class_id", cls!.id);
  const { data: math } = await db
    .from("subjects")
    .select("id, name_en, name_bn")
    .eq("code", "MATH")
    .single();
  const karim = pupils!.find((p) => p.student_id === KARIM)!;
  return {
    db,
    session: session!,
    cls: cls!,
    sectionA: sections.find((s) => s.id === karim.section_id)!,
    pupils: pupils!.map((p) => ({
      ...p,
      student: p.student as unknown as Named & {
        full_name_en: string;
        full_name_bn: string;
      },
    })),
    taught: taught!,
    math: math!,
    karim: {
      ...karim,
      student: karim.student as unknown as {
        full_name_en: string;
        full_name_bn: string;
      },
      group: karim.group as unknown as Named,
    },
  };
}

/** Waits for a notification and for it to close (on phones it can cover buttons). */
async function toast(page: Page, text: string | RegExp) {
  const note = page.getByText(text).last();
  await expect(note).toBeVisible();
  await page.mouse.move(1, 1);
  await expect(note).toBeHidden({ timeout: 15_000 });
}

async function confirmClick(page: Page, name: string) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name, exact: true }).click();
}

for (const lang of ["en", "bn"] as const) {
  test(`exam cycle (${lang})`, async ({ page }) => {
    test.setTimeout(300_000);
    const d = lang === "en" ? en : bn;
    const n = (v: number) => localizeDigits(v, lang as Lang);
    const pick = (row: Named) =>
      lang === "bn" && row.name_bn ? row.name_bn : row.name_en;
    const person = (row: { full_name_en: string; full_name_bn: string }) =>
      lang === "bn" && row.full_name_bn ? row.full_name_bn : row.full_name_en;
    const gpa5 = formatNumber(5, lang, { decimals: 2 });

    const id = `${Date.now()}`.slice(-7);
    const exam = {
      name_en: `E2E Cycle ${id}`,
      name_bn: `ই২ই চক্র ${toBanglaDigits(id)}`,
    };
    const examName = pick(exam);
    const school = await loadSchool();
    const { db, cls, sectionA, math, karim } = school;
    const className = pick(cls);
    const sectionLabel = `${className} ${pick(sectionA)}`;
    const subjectName = pick(math);
    const logout = async () => {
      await page.getByRole("button", { name: d.auth.logout }).click();
      await expect(page).toHaveURL(new RegExp(`/${lang}/login$`));
    };

    try {
      // 1. The office creates the exam for Class 9 and sets up its subjects.
      await loginAs(page, "admin@sunrise.test");
      await page.goto(`/${lang}/dashboard/exams`);
      await page.getByRole("button", { name: d.exams.add }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(d.exams.nameEn).fill(exam.name_en);
      await dialog.getByLabel(d.exams.nameBn).fill(exam.name_bn);
      await dialog.getByLabel(className, { exact: true }).check();
      await dialog.getByRole("button", { name: d.dialog.save }).click();
      await page.getByRole("link", { name: examName, exact: true }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: examName }),
      ).toBeVisible();
      const { data: row } = await db
        .from("exams")
        .select("id")
        .eq("name_en", exam.name_en)
        .single();
      const examId = row!.id;

      const subjectCount = new Set(school.taught.map((t) => t.subject_id)).size;
      await page
        .getByRole("button", {
          name: fmt(d.exams.addClassSubjects, { class: className }),
        })
        .click();
      await toast(page, fmt(d.exams.added, { count: n(subjectCount) }));

      // Mathematics is set to CQ 60 (pass 20) + MCQ 40 (pass 13).
      await page
        .getByRole("button", {
          name: fmt(d.academic.editNamed, {
            name: fmt(d.exams.subjectName, {
              class: className,
              subject: subjectName,
            }),
          }),
        })
        .click();
      const edit = page.getByRole("dialog");
      await edit.getByLabel(d.exams.cqFull, { exact: true }).fill("60");
      await edit.getByLabel(d.exams.cqPass, { exact: true }).fill("20");
      await edit.getByLabel(d.exams.mcqFull, { exact: true }).fill("40");
      await edit.getByLabel(d.exams.mcqPass, { exact: true }).fill("13");
      await edit.getByRole("button", { name: d.dialog.save }).click();
      await expect(edit).toBeHidden();
      await toast(page, d.academic.saved);

      await confirmClick(
        page,
        fmt(d.exams.moveTo, { status: d.exams.statuses.marks_entry }),
      );
      await expect(page.getByTestId("exam-status")).toHaveText(
        d.exams.statuses.marks_entry,
      );

      // Other subjects (other teachers) are entered for everyone with the service role:
      // all pass, Karim gets A+ everywhere. 9A Mathematics is left to the teacher.
      const { data: papers } = await db
        .from("exam_subjects")
        .select("id, subject_id, cq_full, mcq_full, practical_full")
        .eq("exam_id", examId);
      const mathPaper = papers!.find((p) => p.subject_id === math.id)!;
      expect(mathPaper).toMatchObject({ cq_full: 60, mcq_full: 40 });
      const rows = [];
      for (const p of school.pupils)
        for (const paper of papers!) {
          const groups = school.taught
            .filter((t) => t.subject_id === paper.subject_id)
            .map((t) => t.group_id);
          const takes =
            groups.includes(null) ||
            (p.group_id !== null && groups.includes(p.group_id));
          if (!takes) continue;
          if (paper.id === mathPaper.id && p.section_id === sectionA.id)
            continue;
          const share = p.student_id === KARIM ? 0.86 : 0.6;
          rows.push({
            exam_subject_id: paper.id,
            student_id: p.student_id,
            cq: Math.round(paper.cq_full * share),
            mcq: Math.round(paper.mcq_full * share),
            practical: paper.practical_full
              ? Math.round(paper.practical_full * share)
              : null,
            is_absent: false,
          });
        }
      const { error } = await db.from("marks").insert(rows);
      if (error) throw error;
      await logout();

      // 2. The maths teacher enters 9A's marks; the last student is absent.
      const roster = school.pupils.filter(
        (p) => p.section_id === sectionA.id && p.group_id !== null,
      );
      const absent = roster.at(-1)!;
      await loginAs(page, "teacher@sunrise.test");
      await page.goto(`/${lang}/dashboard/marks`);
      await page.getByLabel(d.marks.exam).selectOption({ label: examName });
      await page.getByRole("button", { name: d.marks.show }).click();
      const entry = `${sectionLabel} · ${subjectName}`;
      await page.getByLabel(d.marks.what).selectOption({ label: entry });
      await page.getByRole("button", { name: d.marks.show }).click();
      await expect(
        page.getByRole("heading", { level: 2, name: `${examName} · ${entry}` }),
      ).toBeVisible();
      const field = (part: string, name: string, full: number) =>
        page.getByLabel(fmt(d.marks.fieldLabel, { part, name, full: n(full) }));
      for (const p of roster) {
        const name = person(p.student);
        if (p === absent) {
          await page.getByLabel(fmt(d.marks.absentLabel, { name })).check();
          continue;
        }
        const top = p.student_id === KARIM;
        await field(d.marks.cq, name, 60).fill(n(top ? 52 : 40));
        await field(d.marks.mcq, name, 40).fill(n(top ? 36 : 25));
      }
      await expect(page.getByTestId("marks-progress")).toContainText(
        fmt(d.marks.progress, {
          entered: n(roster.length),
          total: n(roster.length),
        }),
      );
      await expect(page.getByText(d.marks.savedAll)).toBeVisible({
        timeout: 10_000,
      });
      await confirmClick(page, d.marks.submit);
      await expect(page.getByText(d.marks.submitted).last()).toBeVisible();
      const karimName = person(karim.student);
      await expect(field(d.marks.cq, karimName, 60)).toBeDisabled();
      // bn uses Bangla digits everywhere, also in saved marks (CLAUDE.md rule 3).
      await expect.soft(field(d.marks.cq, karimName, 60)).toHaveValue(n(52));
      await logout();

      // 3. The office closes marks, processes, reviews the tabulation sheet, publishes.
      await loginAs(page, "admin@sunrise.test");
      await page.goto(`/${lang}/dashboard/exams/${examId}?tab=results`);
      await confirmClick(
        page,
        fmt(d.exams.moveTo, { status: d.exams.statuses.review }),
      );
      await expect(page.getByTestId("exam-status")).toHaveText(
        d.exams.statuses.review,
      );
      await confirmClick(page, d.results.process);
      await toast(page, anyCount(d.results.processed));
      await expect(page.getByTestId("results-state")).toContainText(
        d.results.processedAt.split("{")[0]!.trim(),
      );
      await expect(page.getByTestId("results-summary")).toContainText(
        `${d.results.failed}${n(1)}`,
      );

      await page
        .getByRole("link", {
          name: fmt(d.results.tabulationOf, { section: sectionLabel }),
        })
        .click();
      const sheet = page.getByTestId("tabulation");
      const karimRow = sheet.getByRole("row", { name: new RegExp(karimName) });
      await expect(karimRow).toContainText(gpa5);
      await expect(karimRow).toContainText("A+");
      const absentRow = sheet.getByRole("row", {
        name: new RegExp(person(absent.student)),
      });
      await expect(absentRow).toContainText(d.results.absent);
      await expect(absentRow).toContainText(d.results.fail);

      await page.goto(`/${lang}/dashboard/exams/${examId}?tab=results`);
      await confirmClick(
        page,
        fmt(d.exams.moveTo, { status: d.exams.statuses.published }),
      );
      await expect(page.getByTestId("exam-status")).toHaveText(
        d.exams.statuses.published,
      );
      await logout();

      // 4. A visitor finds Karim's mark sheet (own IP: the search is rate-limited).
      await page.setExtraHTTPHeaders({
        "x-forwarded-for": `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 255)).join(".")}`,
      });
      await page.goto(`/${lang}/result`);
      const form = page.getByTestId("result-search");
      await form
        .getByLabel(d.results.session)
        .selectOption({ label: n(Number(school.session.name)) });
      await form.getByLabel(d.result.exam).selectOption({ label: examName });
      await form
        .getByLabel(d.result.class, { exact: true })
        .selectOption({ label: className });
      await form
        .getByLabel(d.result.section)
        .selectOption({ label: pick(sectionA) });
      await form
        .getByLabel(d.result.group)
        .selectOption({ label: pick(karim.group) });
      await form.getByLabel(d.result.roll).fill(n(karim.roll));
      await form.getByRole("button", { name: d.result.search }).click();
      const card = page.getByTestId("mark-sheet");
      await expect(card).toContainText(karimName);
      await expect(card).toContainText(`${d.results.markSheet}: ${examName}`);
      const summary = page.getByTestId("mark-sheet-summary");
      await expect(summary).toContainText(`${d.results.gpa}${gpa5}`);
      await expect(summary).toContainText(`${d.results.grade}A+`);
      await expect(card).not.toContainText(d.students.code);

      // 5. The guardian sees the same result in the portal.
      await loginAs(page, "guardian@sunrise.test");
      await page.goto(`/${lang}/dashboard/my-children`);
      await page
        .getByTestId("portal-student")
        .filter({ hasText: karimName })
        .getByRole("link", { name: d.results.title })
        .click();
      await page
        .getByRole("link", {
          name: fmt(d.results.viewNamed, { name: examName }),
        })
        .click();
      await expect(page.getByTestId("mark-sheet")).toContainText(
        d.students.code,
      );
      await expect(page.getByTestId("mark-sheet-summary")).toContainText(
        `${d.results.result}${d.results.pass}`,
      );
      await expect(page.getByTestId("mark-sheet-summary")).toContainText(
        `${d.results.gpa}${gpa5}`,
      );
    } finally {
      // Cascades to exam_classes, exam_subjects, marks, mark_locks and results.
      await adminClient().from("exams").delete().eq("name_en", exam.name_en);
    }
  });
}
