// Writes the processed Half Yearly results into supabase/seeds/07_results.sql, using the
// same code as "Process results". Run against a freshly reset local database:
//   npm run seed:results
import { readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { expect, test, vi } from "vitest";

import { buildResults } from "@/lib/results-build";
import { loadExamInput } from "@/lib/results-input";

vi.mock("server-only", () => ({}));

const FILE = "supabase/seeds/07_results.sql";
const MARK = "-- Generated results (do not edit by hand).";
const EXAM = "Half Yearly Exam 2026";
const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

test("generate seed results", async () => {
  const db = createClient(process.env.SEED_URL!, process.env.SEED_KEY!, {
    auth: { persistSession: false },
  });
  const { data: exam } = await db
    .from("exams")
    .select("id")
    .eq("name_en", EXAM)
    .single();
  const input = await loadExamInput(db as never, exam!.id);
  const { rows, missing } = buildResults(input!);
  expect(missing).toEqual([]);
  const { data: students } = await db
    .from("students")
    .select("id, student_code")
    .in(
      "id",
      rows.map((r) => r.student_id),
    );
  const code = new Map((students ?? []).map((s) => [s.id, s.student_code]));
  const values = rows
    .sort((a, b) =>
      code.get(a.student_id)!.localeCompare(code.get(b.student_id)!),
    )
    .map(
      (r) =>
        `  (${q(code.get(r.student_id)!)}, ${r.total}, ${r.full_total}, ${r.gpa}, ${r.gpa_without_fourth}, ` +
        `${q(r.grade)}, ${r.passed}, ${r.failed_count}, ${r.section_position}, ${r.class_position}, ` +
        `${r.attendance_percent ?? "null"},\n   ${q(JSON.stringify(r.subjects))})`,
    )
    .join(",\n");
  const sql = `${MARK}
insert into public.results (exam_id, student_id, section_id, group_id, roll, total, full_total, gpa,
  gpa_without_fourth, grade, passed, failed_count, section_position, class_position,
  attendance_percent, subjects)
select e.id, st.id, en.section_id, en.group_id, en.roll, x.total, x.full_total, x.gpa, x.gpaw,
  x.grade, x.passed, x.failed_count, x.spos, x.cpos, x.att::numeric, x.subjects::jsonb
from (values
${values}
) as x(code, total, full_total, gpa, gpaw, grade, passed, failed_count, spos, cpos, att, subjects)
join public.students st on st.student_code = x.code
join public.exams e on e.name_en = ${q(EXAM)}
join public.enrollments en on en.student_id = st.id and en.session_id = e.session_id;

update public.exams set results_processed_at = now() where name_en = ${q(EXAM)};
`;
  const current = readFileSync(FILE, "utf8");
  const head = current.includes(MARK)
    ? current.slice(0, current.indexOf(MARK))
    : `${current}\n`;
  writeFileSync(FILE, head + sql);
});
