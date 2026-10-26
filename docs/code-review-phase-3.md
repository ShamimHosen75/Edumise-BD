# Phase 3 code review

Scope: `git diff d0957a8..HEAD` (Steps 3.1–3.5): 185 files, about 20,000 lines.
Reviewed 2026-10-26 as a strict senior reviewer, in four parts: security; correctness of
admission and students; correctness of academic setup, staff and routine; performance,
maintainability and UX. Findings were checked against the code, and the database ones
against the local Supabase. Security and correctness items were fixed in the same change,
with regression tests (unit `review-phase-3.test.ts`, pgTAP `300_phase3_review`).
Database fixes are in a new migration, `20261026003000_phase3_review_fixes.sql`;
applied migrations were not edited.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | Anyone who knew a parent's mobile number (and name) could join that family. Approval reused an existing guardian with the same mobile and name, and the guardian login quietly linked to any existing login with that mobile. The applicant's login could then see the other children's private records. | `approve_admission`, `src/lib/auth/linked-login.ts` | Approval always creates its own guardian records. A mobile that already logs in is never linked automatically: the office sees "this mobile already has a login" and, if it is the same family, adds the existing guardian on the Guardians tab (where it sees that guardian's children). | ✅ Fixed | pgTAP "an existing guardian … is not reused" |
| S2 | The public document upload had no limit per application: a valid one-hour token could fill the private bucket, and parallel uploads left files no row pointed to. | `(site)/admission/actions.ts` | 8 uploads per application per hour, only while the application is "submitted". After each upload, files in the application folder that no row uses are removed. | ✅ Fixed | — |
| S3 | Any admin could reset another admin's password (and sign in as them) or switch them off. Deleting a staff record that belongs to another admin switched them off too. | `staff/login-actions.ts`, `staff/actions.ts` | `canManageLogin`: never your own login; only a super admin manages admins and super admins. | ✅ Fixed | unit `canManageLogin` |
| S4 | A staff login could use the reserved student/guardian addresses (`…@student.invalid`), and so sign in by a student ID. | `validation/staff.ts` | Those domains are refused. | ✅ Fixed | unit |
| S5 | Student IDs are sequential: repeated wrong passwords from one address can lock students out for 15 minutes (per-account failure limit). | `(auth)/actions.ts` | Accepted for now; revisit with captcha/backoff in Step 6.2. | 📝 6.2 | — |
| S6 | Server actions accepted a session whose one-time password was not yet changed (only the dashboard layout redirected). | `src/lib/auth/session.ts` | `requireRole` sends such users to "choose a password". (Direct API calls with the token remain possible; RLS still limits them.) | ✅ Fixed | e2e login flows |
| S7 | Admins can write any action into the audit log through `record_audit`. The actor is always recorded correctly. | `20261025002700_admissions.sql` | Accepted (admins only); allowlist of actions in Step 6.2. | 📝 6.2 | — |
| S8 | Upload tokens were signed with the service-role key (two uses, one key). | `(site)/admission/actions.ts` | `ADMISSION_TOKEN_SECRET` (in `.env.example`) is used when set; the service key stays the fallback. | ✅ Fixed (set it at deploy, 6.4) | — |

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | Lists were silently cut at 1000 rows (the API's `max_rows`), whatever `.limit()` asked for. That cut the student list, the promotion list and CSV export, the import duplicate checks, the admission queue, and the routine. Saving a routine could then delete classes that had not loaded. | `students-data.ts`, `import-actions.ts`, `admissions-data.ts`, `routine-data.ts` | `fetchAll` reads page by page with a stable order. | ✅ Fixed | unit `fetchAll` |
| C2 | The guardian "My children" page crashed when a child had a second guardian, because RLS hides the other guardian's record. | `src/lib/portal-data.ts` | Other guardians are left out. | ✅ Fixed | e2e portal |
| C3 | Approval always failed when the local guardian had the father's or mother's name (the same row was linked twice). The admin was then told the application was "already approved". | `approve_admission`, `admissions/actions.ts` | That record becomes the main contact. A duplicate birth registration number now says so. | ✅ Fixed | pgTAP |
| C4 | Student IDs were reused after a delete (highest + 1), and the reused ID's old login blocked the new one. | `app.next_student_code`, `students/actions.ts` | A counter per year and class (`student_code_counters`, never goes back); a deleted student's login is deleted. Over 9999 IDs gives a clear error. | ✅ Fixed | pgTAP "never reused" |
| C5 | Promotion silently left out students whose section has no same-named section in the next class. It could also default to promoting into an older session. | `promote_students`, `promotion-tool.tsx` | Refused with a clear message, and only into a later session. The tool has no target session until one is chosen. | ✅ Fixed | pgTAP (2) |
| C6 | Test marks such as 72.1 or 33.3 were refused (floating-point check). | `validation/admission.ts` | Compared with a tolerance. | ✅ Fixed | unit |
| C7 | A routine could not be saved any more after a working day was switched off or a period became a break (hidden cells were sent and refused). | `dashboard/routine/page.tsx` | Those classes are left out, with a note that saving removes them. | ✅ Fixed | — |
| C8 | Deleting a period silently removed its classes from every routine. | `academic/actions.ts` | "In use" while the routine has classes in it. | ✅ Fixed | — |
| C9 | Changing a class between 6–8 and 9–10 left its subject list unusable (subjects per group vs none). | `academic/checks.ts` | Refused while the class has subjects. | ✅ Fixed | — |
| C10 | An exam paper could be moved to another exam via a crafted request; class, subject and date were not checked against the exam. | `academic/checks.ts` | A paper stays in its exam; the class must sit the exam, the subject must be taught in the class, the date must be within the exam's dates. | ✅ Fixed | e2e exam schedule |
| C11 | Unique errors on designations showed under the wrong field. | `academic/actions.ts` | `duplicateField` reads the index name. | ✅ Fixed | unit |
| C12 | Reusing an existing guardian login reported success but failed (unique `profile_id`). A double click on "create login" could leave an unlinked account. | `linked-login.ts` | No automatic reuse (S1); 0 linked rows counts as failure and the new account is removed. | ✅ Fixed | — |
| C13 | A student could end up with no main contact, or with two (two separate updates, no constraint). | `guardian-actions.ts` | `set_primary_guardian()` in one step plus a unique index; an orphan new guardian is removed if linking fails. | ✅ Fixed | pgTAP (3) |
| C14 | A failed student delete (fees still referring to them) left the student's login switched off. | `students/actions.ts` | The delete comes first. | ✅ Fixed | — |
| C15 | The merit list mixed sessions, and matched classes by name. | `admissions/merit/page.tsx` | Filtered by current session and class id in the query. | ✅ Fixed | e2e admission |
| C16 | The calendar missed events that began in an earlier month. | `site/routine-data.ts` | Overlap query in Dhaka time. | ✅ Fixed | — |
| C17 | Smaller fixes, done:<br>• Student IDs and mobile numbers typed with Bangla digits are now accepted at login, and table search matches Bangla digits.<br>• An impossible date in the admission filter crashed the page.<br>• Birth dates were checked against the UTC date instead of the Dhaka date.<br>• A new staff record whose private part failed to save was saved twice on retry.<br>• Class subjects were removed before the new ones were added.<br>• The builder now refreshes other sections after a clash.<br>• Teachers who have left now keep their name in the routine.<br>• The 140-class week limit is fixed.<br>• List keys no longer repeat. | various | Fixed. | ✅ Fixed | unit login digits |
| C18 | Promoting into Class 9 and importing into Classes 9–10 leave the group empty. | promotion, import | Group is set on the profile. A group choice in both tools comes with the next change to them. | 📝 Later | — |
| C19 | DataTable returns to page 1 after each edit (refresh). | `data-table.tsx` | Minor; keep until paging is reworked. | 📝 Later | — |

## Performance

| # | Finding | Status |
|---|---|---|
| P1 | 1000-row cap (C1). | ✅ Fixed |
| P2 | The admission queue sorted by date had no matching index, and a teacher's routine had no index starting with the teacher. A redundant enrolment index was added in Step 3.4. | ✅ Indexes added/dropped in the review migration |
| P3 | The merit page loaded every application (C15). | ✅ Fixed |
| P4 | `studentDetail` signs every file on every tab, one request each; `admissionDetail` does the same. | 📝 Later: load documents on the Documents tab only, `createSignedUrls` |
| P5 | `saveRoutine` loads names it does not need; `myChildren`, `staffDetail`, `my-routine` run queries one after another. | 📝 Later |
| P6 | The public calendar accepts any month 1900–2099 (crawlers). | 📝 Later: limit to ± a year and `nofollow` |
| P7 | An academic save clears more public caches than it needs; admin pages send 19–27 kB of strings. | 📝 Later |

## Maintainability (recorded, not changed now)

| # | Finding | Suggested fix |
|---|---|---|
| M1 | `one<T>()` and `as unknown as` casts repeated in many data files; the generated types already know the embedded rows. | Remove them file by file when touched. |
| M2 | "Class 6 A" labels and section queries are written five times. | One `sectionLabel` helper in `lib/academic.ts`. |
| M3 | Four separate GET select forms (ChoiceForm, SessionPicker, merit, promotion). | One `ChoiceForm` with several selects. |
| M4 | `translator`, `tableLabels`, `CrudTable` live in the academic folder but are shared. | Move to `components/dashboard/shared`. |
| M5 | Admin role list repeated in layouts and actions. | `ADMIN_ROLES` constant and `requireAdminPage`. |
| M6 | `apply-form.tsx` (423 lines) and `data-table.tsx` (367) are over the ~300-line rule. | Split (draft hook, upload helper; toolbar, header, pagination). |
| M7 | ID card labels are written in the PDF component. | `idCard` dictionary section (English). |

## UX / i18n / accessibility

| # | Finding | Status |
|---|---|---|
| U1 | Session names showed English digits on Bangla pages (pickers, titles, staff assignments). | ✅ Fixed |
| U2 | The routine cell editor opened off-screen on phones, and focus stayed on the cell. | ✅ Fixed: the editor scrolls into view and takes focus; focus goes back to the cell |
| U3 | Every clash in the grid was a separate `role="alert"`, so screen readers announced them again on each re-render. | ✅ Fixed: plain text plus one status line |
| U4 | Wide tables (routine, calendar, exam routine, promotion, history) could not be scrolled from the keyboard. | ✅ Fixed: focusable labelled regions |
| U5 | Bangla wording problems:<br>• "Graduated" was the same word as "Promoted".<br>• "Transferred" read like a staff posting.<br>• "Session" was translated two ways.<br>• The import hint carried a developer note. | ✅ Fixed |
| U6 | A dashboard error dropped the whole dashboard. | ✅ Fixed: `dashboard/error.tsx` keeps the sidebar. A dashboard-wide `loading.tsx` was not added: it would make pages that check the role themselves answer 200 instead of 403 |
| U7 | Bangla titles broke DataTable ids and CSV names. | 📝 Later: `useId`, required `csvName` |
| U8 | The routine builder has no "unsaved changes" warning. The application draft keeps the birth date, address and phone in the browser's storage on shared computers. | 📝 Later (decide on draft clearing with the owner) |
