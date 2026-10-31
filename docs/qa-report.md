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
| QA-01 | Minor | EXM-02 (and the i18n rule) | Saved marks show Latin digits in the Bangla marks grid | ✅ Fixed |
| QA-02 | Cosmetic | ADM-04 (and the i18n rule) | The admission approval message shows the student ID in Latin digits in Bangla | ✅ Fixed |
| QA-03 | Minor (tests) | ADM-01…04 | The older `admission.spec.ts` leaves its applications, students and guardian logins in the database | ✅ Fixed |
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

### Fixes (owner approved, 2026-10-31)

| ID | Fix | Test |
|---|---|---|
| QA-01 | Saved marks are shown in the reader's digits (`localizeDigits` in `marks-grid.tsx`). Typing either kind of digit still works. | `day-exam-cycle.spec.ts` › "exam cycle (bn)": the check is now a hard assertion and passes. |
| QA-02 | The approval messages show the student ID with Bangla digits in Bangla (`review-panel.tsx`). | `day-admission-school.spec.ts` now requires the reader's digits. |
| QA-03 | `admission.spec.ts` cleans up in `finally`, with `cleanupApplication()` (moved to `tests/e2e/helpers.ts`, shared with the scenario). | No test students or applications are left after the run. |

QA-04 is still being watched. It did not happen again in either full run.

### Re-run after the fixes

| Suite | Result |
|---|---|
| Lint, typecheck | ✅ |
| Unit | ✅ 516 |
| Database | ✅ 504 |
| End to end | ✅ **273 passed, 0 failed**, 5 skipped by design |

All 20 runs of the five scenarios pass (English and Bangla, desktop and phone).

## Step 6.3: performance, accessibility and SEO (2026-10-31)

**Lighthouse, mobile** (Moto G emulation, slow 4G, 4× CPU slowdown), production build against the local database. Target: every category ≥ 90.

| Page | Before (P / A / BP / SEO) | After (P / A / BP / SEO) |
|---|---|---|
| Home `/en` | 75 / 96 / 92 / 100 | **91** / **100** / **96** / 100 |
| Notice list `/en/notices` | 90 / 100 / 92 / 100 | **93** / 100 / **96** / 100 |
| Notice detail | 90 / 100 / 92 / 91 | **97** / 100 / 92 / 91 |
| Result search `/en/result` | 96 / 100 / 92 / 91 | 93 / 100 / **96** / **100** |
| Teachers `/en/teachers` | 97 / 100 / 92 / 91 | 95 / 100 / **96** / **100** |

Home page: LCP 4.3 s → 2.5 s, Speed Index 2.3 s → 1.0 s, blocking time 420 ms → 320 ms.

**What was slow, and the fixes**
- **Fonts delayed the hero image.** Eight Bangla font files (4 weights × 2 subsets, about 320 KB) were preloaded on every page and competed with the hero image on a phone connection. Hind Siliguri now has three weights (400, 600, 700; "medium" falls back to regular) and no preload: with unicode-range, a page downloads only the files its text needs. One font file loads on the English home page instead of nine.
- **Hero image:** `fetchpriority="high"` on the first slide.
- **No favicon** (a 404 in the console on every page, counted against Best Practices): the school's own favicon from settings, else a built-in `/icon.svg`.
- **CSP blocked the inline PDF preview** on notices (Chrome's PDF viewer needs `frame-src`). `frame-src` now allows the site and the storage origin.
- **Tap targets:** the carousel dots were 10 px; they now sit in 24 px buttons, and the notice ticker links have padding.
- **Meta description "missing" (SEO 91 on two pages):** Next.js streams the metadata of dynamic pages into the body for browsers that run JavaScript, and Lighthouse's emulated browser is not on its bot list. The description is present; search engines on the list (Googlebot, Bingbot and others) get it in `<head>`. Left as is, 91 ≥ 90.

**axe** (`@axe-core/playwright`, WCAG 2.1 A/AA and best practices) on 43 public pages and 19 dashboard pages across the five roles. Serious and critical violations found and fixed:
- **"Accessible name does not contain the visible text"** on the header logo link, every attendance tap button and every routine cell: these had an `aria-label` next to multi-part visible text. The names now come from the visible text plus hidden extra words ("Home:", "Tap to change.", "Sunday, period 1:").
- **Colour contrast:** small grey text (`--muted-foreground`) failed on grey backgrounds (table headers, the "No login" badge), and red text failed on tinted red cells (calendar holidays). Both tokens are darker now and pass AA everywhere; white text on red buttons improved as well.
- New test `accessibility.spec.ts` keeps these pages free of serious and critical violations.

**360px:** `mobile-print.spec.ts` opens 70 dashboard screens as admin, teacher, accountant, guardian and student on a 360×740 phone and asserts no sideways scrolling (tables scroll inside their own box). Found and fixed: the content lists (notices, news, events, gallery, downloads, pages) and the portal results list made the page about 200 px wider than the screen. The tables themselves scrolled in their box, but their hidden screen-reader labels are absolutely positioned and stuck out of it. Every table scroll box is now a positioned container, so hidden text stays inside.

**Print:** receipt, mark sheet, attendance sheet, class routine and the public routine hide the navigation and keep their content when printed. One bug found and fixed: the dashboard sidebar printed on every page (no print rule).

**Lighthouse CI:** `lighthouserc.json` and a step in the e2e CI job run Lighthouse (mobile) on the home page after each push; any category under 90 fails the build. Locally: `npm run lighthouse`.
