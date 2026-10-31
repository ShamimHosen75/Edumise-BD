# QA report

## Step 6.1: full regression (2026-10-31)

**Build under test:** `main` at `04b3250` (after the Phase 5 code review), production build (`next start`), local Supabase reset to the demo seed.

### What ran

| Suite | Result |
|---|---|
| `npm run lint`, `npm run typecheck` | ✅ clean |
| Unit (Vitest) | ✅ 37 files, 516 tests |
| Database (pgTAP) and `supabase db lint` | ✅ 32 files, 504 tests; no schema errors |
| End to end (Playwright, desktop Chrome and 360×740 phone) | ❌ **271 passed, 2 failed, 5 skipped** |

**The five "day in the life" scenarios** each run in English and Bangla, on desktop and phone (20 runs):

| Scenario | File | en desktop | en phone | bn desktop | bn phone |
|---|---|---|---|---|---|
| Admission season (apply → status → test → approve → class list) | `day-admission-school.spec.ts` | ✅ | ✅ | ✅ | ✅ |
| A school day (attendance → admin widget and sheet → guardian calendar) | `day-admission-school.spec.ts` | ✅ | ✅ | ✅ | ✅ |
| Exam cycle (setup → marks → process → publish → public search → portal) | `day-exam-cycle.spec.ts` | ✅ | ✅ | ❌ QA-01 | ❌ QA-01 |
| Fee month (fee → invoices → part and full payment → dues and daily reports) | `day-fees-website.spec.ts` | ✅ | ✅ | ✅ | ✅ |
| Website editor (notice, page, gallery) | `day-fees-website.spec.ts` | ✅ | ✅ | ✅ | ✅ |

The **2 failures** are the Bangla exam cycle on desktop and on phone, both from QA-01. That check is a soft assertion, so the rest of each Bangla run still completed and passed: processing, tabulation, publishing, public search and the guardian portal.

The **5 skipped** tests are by design: desktop-only or phone-only checks (menus, sidebar, phone layout) skip on the other viewport.

**Traceability:** `docs/traceability.md`. Every cited requirement ID has tests. The gaps found (fee reports and the News module) were filled in `coverage-gaps.spec.ts`.

### Findings

| ID | Severity | Requirement | Title | Status |
|---|---|---|---|---|
| QA-01 | Minor | EXM-02 (and the i18n rule) | Saved marks show Latin digits in the Bangla marks grid | Open (Minor: waiting for the owner) |
| QA-02 | Cosmetic | ADM-04 (and the i18n rule) | The admission approval message shows the student ID in Latin digits in Bangla | Open |
| QA-03 | Minor (tests) | ADM-01…04 | The older `admission.spec.ts` leaves its applications, students and guardian logins in the database | Open |
| QA-04 | Not reproduced | WEB-07 | Once, on the phone in Bangla, saving a new page sent the admin to the login page | Watching |

No Blockers or Majors were found, so nothing in step 5 had to be fixed.

#### QA-01: saved marks show Latin digits in the Bangla marks grid (Minor)
- **Steps:**
  1. Sign in as `teacher@sunrise.test`.
  2. Open `/bn/dashboard/marks`, choose an exam in marks entry, and pick "নবম শ্রেণি ক · গণিত".
  3. Type "৫২" in Karim Ahmed's CQ box.
  4. Press "জমা দিন ও লক করুন" and confirm.
- **Expected:** the saved value shows "৫২", like the column headers ("(৬০)") and the totals.
- **Actual:** it shows "52". This also happens every time saved marks are loaded again.
- **Cause:** `toText()` in `src/components/dashboard/marks/marks-grid.tsx` uses `String(v)` without `localizeDigits`.
- **Test:** `day-exam-cycle.spec.ts` › "exam cycle (bn)", which fails on both viewports.

#### QA-02: student ID in Latin digits in the Bangla approval message (Cosmetic)
- **Steps:** as admin in Bangla, approve an application.
- **Expected:** the success message shows the new student ID in Bangla digits, as the roll and the students list do.
- **Actual:** the ID is in Latin digits.
- **Test:** `day-admission-school.spec.ts` accepts either kind of digit there for now.

#### QA-03: `admission.spec.ts` does not clean up (Minor, test suite)
- **Steps:** run `tests/e2e/admission.spec.ts`.
- **Expected:** the application, the student, the guardians and the guardian login it creates are deleted afterwards, as the newer specs do.
- **Actual:** they stay in the shared database. Repeated local runs slowly add students to Class 6 A. CI starts from a fresh database each time, so CI is not affected.

#### QA-04: one lost session on the phone after saving a page (not reproduced)
- **Seen:** once, while the scenario was being written. Other test runs were using the same server at that moment.
- **What happened:** the phone, Bangla website-editor run went to `/bn/login` right after "Save page" on a new page.
- **Since then:** it passed in 4 later runs and in the full run above. Logged so it can be checked if it happens again (for example, session refresh during long editing sessions).

### Waiting for the owner

As Step 6.1 says, the Minor and Cosmetic findings (QA-01 to QA-03) are **not fixed yet**. Please confirm, and they will be fixed one by one, with the report updated.
