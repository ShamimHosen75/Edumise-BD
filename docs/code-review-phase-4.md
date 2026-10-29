# Phase 4 code review

Scope: `git diff b99d6a4..9d0c76b` (Steps 4.1–4.4: attendance, exams and marks, grading
and results, certificates): 154 files, about 14,000 lines. Reviewed 2026-10-30 as a strict
senior reviewer, in four parts:
- security;
- correctness of attendance, exams and marks;
- correctness of results and certificates;
- performance, maintainability and UX.

Findings were checked against the code; the database ones against the local Supabase, in
transactions that were rolled back. Security and correctness items were fixed in the
same change, with regression tests:
- unit: `review-phase-4.test.ts` and `xlsx-read.test.ts`;
- pgTAP: `350_phase4_review`.

Database fixes are in a new migration, `20261030003500_phase4_review_fixes.sql`; applied
migrations were not edited.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | A crafted Excel file could block the server for hours. Lazy regular expressions became quadratic on unclosed tags, and a 20 MB sheet part compressed below the 2 MB upload limit. Reachable by any teacher through the marks import. | `src/lib/xlsx-read.ts` | Linear `indexOf` scanning for rows, cells and strings; part limit lowered to 4 MB. | ✅ Fixed | unit "reads many unclosed tags in linear time" (19 s before, milliseconds after) |
| S2 | A row number such as `r="999999999"` in an Excel file padded millions of empty rows and ran Node out of memory. | `xlsx-read.ts` | Row numbers above the sheet limit stop reading. | ✅ Fixed | unit "does not pad millions of rows" |
| S3 | A teacher could record another person (an admin) as the author of a mark through the API (`entered_by` was not checked). | marks policies | A trigger sets `entered_by` to the person saving. | ✅ Fixed | pgTAP |
| S4 | "Submit & lock" checked only the teaching assignment, not the role. A former teacher whose role changed (or a switched-off login with a valid token) could lock a subject. | `app.can_enter_section` | Also requires the teacher role (or admin). | ✅ Fixed | pgTAP |
| S5 | The public result search allowed 60 searches per 10 minutes per address with no daily limit. One address could step through every roll of the school in a few hours. Nothing private is shown, but the whole list could be collected. | `(site)/result/page.tsx` | Added a daily cap of 300 per address on top of the 10-minute limit. | ✅ Fixed | — |
| S6 | Before publication, any teacher of a section could read every subject's marks in that section's results, which is more than the marks policy allows them. | results policy | Before publishing: the office and the class teacher only. Subject teachers see results once they are published. | ✅ Fixed | pgTAP |
| S7 | A malformed address such as `/verify/%E0` caused a server error (500) instead of "invalid reference". | `(site)/verify/[ref]/page.tsx` | Decoding errors are treated as an invalid reference. | ✅ Fixed | — |

Checked and fine:
- `lookup_result` and `verify_certificate` are callable only by the server, after
  validation and the rate limit, and return no ID, birth date, photo or family details.
- Every PDF and export route checks the role itself.
- Certificate references are random and not guessable.
- Certificates, results and mark locks are written only through admin-checked functions.
- Attendance and marks policies enforce the edit window, the teacher's assignments and locks.
- Uploads are size-limited, and parsed rows cannot pollute prototypes.

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | Results could be published out of date. The check compared `updated_at` columns, so a deleted mark, a deleted exam subject or a change of enrolment, roll, group, fourth subject, student status or grading scale went unnoticed. An edit made while results were processing also counted as included. | `app.results_current`, `resultsState` | Every such change stamps `exams.inputs_changed_at` (triggers). Results are current only if processed after that. Processing passes the time it started reading. The Results tab uses the same rule. | ✅ Fixed | pgTAP "deleting a mark…", "an enrolment change…" |
| C2 | Autosave could lose an edit and still say "All changes saved". Typing during a save made the reply mark the newer value as saved. | `marks-grid.tsx` | After a save, only rows whose draft still equals what was sent are marked saved. | ✅ Fixed | — |
| C3 | Sections with two groups (e.g. 9B: Business and Humanities) could not "Submit & lock" a group subject. Students of the other group were listed and counted as missing, and completion never reached 100%. This disagreed with grading. | `submit_marks`, marks page, `examCompletion` | Rosters, completion and submit count only students taught the subject in their group (`app.takes_subject`, `takesSubject`). Sections where nobody takes it are hidden. | ✅ Fixed | pgTAP "submit counts only the students who take the subject" |
| C4 | A row with one part filled in (CQ but no MCQ) counted as entered and could be locked. The empty part then counted as 0 and failed the student. | `submit_marks`, `marks.ts`, grid, grading | A row is complete only when every part in use has a mark (or the student is absent). This applies to submit, progress, completion and processing (as missing). | ✅ Fixed | pgTAP, unit |
| C5 | Students who left (transfer certificate) or are inactive stayed in the marks and attendance lists. They blocked "Submit & lock" and processing, then got an F, a position and a public result. | rosters, `loadExamInput`, `submit_marks` | Left out of taking attendance and marks, completion, submit and processing (kept on past attendance sheets). | ✅ Fixed | pgTAP "a transferred student is not counted" |
| C6 | Full marks could be lowered below marks already saved, giving percentages over 100. | exam subjects | Refused by a trigger, with a clear message in the form. | ✅ Fixed | pgTAP |
| C7 | Deleting an exam subject or an exam silently deleted its marks, locks and results. Exam subjects could also be changed after results were published. | `academic/actions.ts`, `checks.ts`, `exams/actions.ts` | "In use" while marks exist. No subject changes while the exam is published (move it back to Review first). | ✅ Fixed | — |
| C8 | Clearing a mark after the subject was submitted (or the exam closed) reported "saved". The database blocked the delete without an error, and the mark stayed. | `marks/actions.ts` | Deleted rows are compared with the rows that were there; otherwise "locked". | ✅ Fixed | — |
| C9 | The monthly sheet for a month of a past session listed this year's students. | `attendance/sheet/data.ts` | Uses the class list of the session the month belongs to. | ✅ Fixed | — |
| C10 | In a paper group, a paper without a pass mark for a part could hide another paper's fail in that part. | `grading.ts` | Only papers with pass marks for the part count towards it. | ✅ Fixed | unit |
| C11 | With two fourth-type subjects and none chosen, neither counted, and GPA was worked out over fewer subjects without any warning. | `grading-subjects.ts`, processing | Processing stops and names how many students need a fourth subject chosen. | ✅ Fixed | unit |
| C12 | Excel values such as `70.150000000000006` were refused in the marks import. | `marks.ts` | Numbers from files are rounded to 2 decimals. | ✅ Fixed | unit |
| C13 | The admin widget said "38 of 40 marked" when 2 students were on leave. | `attendance-data.ts` | Leave counts as marked; the percentage still leaves it out. | ✅ Fixed | — |
| C14 | A student who changes section mid-month appears partly in each section's sheet. | attendance sheet | The percentage is right (unmarked days do not count). | 📝 Later | — |
| C15 | The result search needs JavaScript for its dependent lists (the comment said otherwise). | `result-search.tsx` | Comment corrected; a no-JavaScript version is not planned. | ✅ Noted | — |

## Performance

| # | Finding | Status |
|---|---|---|
| P1 | Processing read every attendance row of the session, about 150k for a whole school, page by page, then quietly stopped at 50,000 rows. | ✅ `attendance_counts()` counts in SQL. Reads run in parallel. `fetchAll` now throws instead of returning a shortened list. |
| P2 | The Results tab and tabulation loaded every full result (with all subjects) of the exam. | ✅ A light overview query; tabulation loads one section. |
| P3 | The certificates list stopped at 1000 rows and loaded every certificate's text. | ✅ Paged, and list columns only. |
| P4 | Marks page and single-exam/result pages run queries one after another or load lists to show one item. | 📝 Later |
| P5 | Bulk mark-sheet PDFs download every photo at once; large sections may near the function time limit. | 📝 Later: limit concurrency, set `maxDuration` |
| P6 | The admin attendance widget counts in JavaScript. | 📝 Later: grouped count in SQL |

## Maintainability

| # | Finding | Status |
|---|---|---|
| M1 | The PDF labels were written into the code. | ✅ Taken from the English dictionary. |
| M2 | `grading.ts` grew past 300 lines with the fixes. | ✅ Subject selection moved to `grading-subjects.ts`. |
| M3 | The ID check regex is repeated in 7 route files. | 📝 Later: one `parseId()` |
| M4 | Some code and dictionary keys are unused (`absenceStreak` UI, a few keys). The role check `isAdmin` sits in `attendance-data.ts`, and the "current session" lookup is repeated. | 📝 Later |

## UX / i18n / accessibility

| # | Finding | Status |
|---|---|---|
| U1 | On Bangla pages with several tables (exam subjects per class), search boxes got duplicate IDs, so one had no label. | ✅ `useId()` |
| U2 | An invalid mark was shown only as a red ring and a tooltip, so screen readers and touch users missed it. | ✅ Visible message under the box, linked and announced |
| U3 | Unsaved attendance can be lost by leaving the page; no undo after "All absent". | 📝 Later |
| U4 | No loading skeletons on the new dashboard pages. | 📝 Later |
| U5 | Failed rows in the tabulation sheet are red across every cell. | 📝 Later: colour the Result cell only |

All checks after the fixes: see the Phase 4 review entry in `docs/progress.md`.
