# Requirement traceability (Step 6.1)

**Source of the IDs:** the full requirement catalogue (ID, text, MoSCoW priority) was never supplied (open question 43). By the owner's decision (2026-10-31):
- This matrix traces every ID cited in the build steps of `docs/requirements.md`.
- Every one of these is treated as **Must**.
- Each is described from its step text. Where a step lists several IDs, the split between them was not given, so they share the step's tests.
- IDs whose numbers fall between the cited ones but are never described (WEB-10, WEB-13, ADM-05, ADM-07, NFR-05) are listed at the end as "no text supplied".

Paste the real catalogue to replace the descriptions and priorities.

**Test locations:**
- `e2e/`: Playwright, `tests/e2e/*.spec.ts`. Every spec runs on desktop Chrome and a 360×740 phone.
- `unit/`: Vitest, `tests/unit/*.test.ts`.
- `db/`: pgTAP, `supabase/tests/*.test.sql`.
- **Day** marks the five "day in the life" scenarios. They run in English and Bangla, on desktop and phone:
  - `day-admission-school.spec.ts`
  - `day-exam-cycle.spec.ts`
  - `day-fees-website.spec.ts`

**Status:** ✅ covered and passing · ⏳ covered by a later step (6.2 / 6.3) · ❌ no test.

## Website (Phase 2)

| ID | Requirement (from the step) | Tests | Status |
|---|---|---|---|
| WEB-01 | Public site shell: top bar (contact, socials, language switch, Apply/Login), header with logo and responsive mega-menu, footer (address, links, socials). (Step 2.1) | e2e/home: "desktop menu: drop-down opens…", "phone menu: sheet opens…", "no broken links in en/bn (crawl and assert 200)", "menu items show only for pages that exist"; e2e/i18n-theme: "switching language keeps the path…", "school name, colour and fonts come from settings"; e2e/smoke: "/en, /bn render with no console errors and fit the screen"; unit/site, unit/nav | ✅ |
| WEB-02 | Home page sections: hero carousel, notice ticker and latest notices, institute facts, quick links, head teacher's message, teacher highlights, live counters, class-wise chart, upcoming events, gallery preview; hidden when empty. (Step 2.1) | e2e/home: "all sections render in en/bn", "live counters come from the database, with Bangla digits in bn", "teacher cards show only public fields", "slideshow can be paused…", "notice ticker can be paused"; unit/home-sections; db/200_site_shell | ✅ |
| WEB-16 | Step 2.1 (shared with WEB-01/02): ISR revalidation, design from settings, works at 360px. | e2e/home (above); e2e/dashboard: "changing the primary colour changes the site colour"; e2e/i18n-theme; e2e/smoke (360px) | ✅ |
| WEB-03 | CMS pages at `/[lang]/p/[slug]` (title, rich content, cover, attachments); seeded static pages; admin page editor with EN/BN, sanitised rich text, SEO. (Step 2.2) | e2e/cms: "admin edits a page in Bangla, publishes it…", "saved HTML cannot run scripts…", "attachments: a real PDF is shown…", "only admins can open the page editor…"; unit/cms (sanitiser); db/210_cms_pages | ✅ |
| WEB-04 | Menu builder: tree, rename EN/BN, reorder, link to page or URL, hide; empty or unpublished pages hidden. (Step 2.2) | e2e/cms: "admin creates a page, links it in the menu…", "menu items can be moved up and down", "empty and unpublished pages are hidden from the menu and return 404"; e2e/home: "menu items show only for pages that exist"; **Day** website editor | ✅ |
| WEB-07 | Content modules (notices, news, events, gallery, downloads): public list with search, filters and paging; detail pages; dashboard CRUD with EN/BN, draft/publish, files. (Step 2.3) | e2e/content: all 10 tests; e2e/content-pages: all; e2e/coverage-gaps: "news: a draft stays hidden; published news shows…" (**new**); unit/content, unit/content-admin; db/220_content_modules; **Day** website editor | ✅ |
| WEB-08 | Step 2.3 (shared): news, events (upcoming and past), gallery albums with bulk upload and lightbox, downloads. | e2e/content: "events are split into upcoming and past", "gallery lightbox moves with the arrow keys…", "admin creates an album and uploads photos in bulk", "downloads show category, size and type…", "admin adds a download…"; e2e/coverage-gaps news (**new**); **Day** website editor (gallery) | ✅ |
| WEB-14 | Step 2.3 (shared): Open Graph metadata, sitemap and robots. | e2e/content: "sitemap and robots are served", "notice page previews the PDF, offers a download and share links" (checks `og:`); e2e/content-pages: "list pages name their own Bangla and English versions" | ✅ |
| NOT-01 | Notices: category, audience, pin, PDF/image attachment with preview and download, share buttons; teachers draft, admins publish; drafts invisible to visitors. (Step 2.3) | e2e/content: "a notice saved as a draft stays hidden; once published it shows on the home ticker and the list", "a teacher writes a notice draft and an admin publishes it", "notices paginate and keep the search…"; db/100_rls_anon (drafts invisible); **Day** website editor | ✅ |
| WEB-05 | Teachers and staff directory, current and former, by designation; profile shows only public fields. (Step 2.4) | e2e/people: "a staff profile page shows public fields only, never NID, birth date or address", "the directory groups by designation and splits current and former staff"; e2e/staff: "admin adds a teacher with private details that never reach the website"; db/030_public_staff | ✅ |
| WEB-06 | Governing body and former governing body by term; former head teachers; dashboard CRUD. (Step 2.4) | e2e/people: "governing body by term, and former head teachers", "admin adds a governing body member and it shows on the public page", "only admins open the inbox and the people editors"; db/230_people_contact | ✅ |
| WEB-15 | Contact page: validated form, honeypot, rate limit (5 per hour per address), map, office hours; admin inbox. (Step 2.4) | e2e/people: "a contact message reaches the admin inbox…", "the contact form allows 5 messages an hour from one address and ignores bots", "contact form shows validation errors in en/bn"; unit/people | ✅ |
| WEB-09 | Public routine, exam schedule and academic calendar pages. (Step 3.5) | e2e/routine: "admin builds a section routine… teacher and public views show it", "exam schedule: add a paper, hide and publish…", "calendar: holidays and events by month…" | ✅ |
| WEB-11 | Board exam results: admin enters year, examinees, passed and GPA-5 counts; public table and pass-rate chart. (Step 4.3) | e2e/results: "board results: the office adds a year and the website shows it", "teachers cannot open board results…"; db/330_results | ✅ |
| WEB-12 | Certificates (testimonial, transfer, character) with reference no and QR; PDF; public verify page and header popup showing only name, type, date and status. (Step 4.4) | e2e/certificates: all 3 tests; unit/certificates; db/340_certificates | ✅ |
| WEB-17 | SEO, performance and accessibility of the public site. (Step 6.3) | e2e/content: sitemap/robots; e2e/smoke. Lighthouse and axe are run in Step 6.3. | ⏳ 6.3 |

## Admissions, students and access (Phase 3)

| ID | Requirement | Tests | Status |
|---|---|---|---|
| ADM-01 | Online admission form at `/[lang]/admission/apply`: multi-step, validated, draft kept on the device, photo and documents with size and type limits. (Step 3.3) | e2e/admission: "apply online, check the status, approve…", "the form keeps answers on this device and works in Bangla"; unit/admission (phone, birth registration validators); **Day** admission season | ✅ |
| ADM-02 | Submission through the server with the admin client; private document upload; tracking no `ADM-YYYY-NNNNN`; printable copy. (Step 3.3) | e2e/admission (above); unit/admission (tracking no); db/270_admissions; **Day** admission season | ✅ |
| ADM-03 | Status check by tracking no and phone. (Step 3.3) | e2e/admission: "apply online, check the status…"; **Day** admission season | ✅ |
| ADM-04 | Admissions queue: filters, documents, status, test schedule and marks, merit list; "Approve" creates student, guardian, enrolment and guardian login in one transaction, audited; visitors cannot read applications. (Step 3.3) | e2e/admission: "apply online… approve, and the student joins the class list", "visitors cannot open the admission queue; teachers get 403"; db/270_admissions, db/100_rls_anon; **Day** admission season | ✅ |
| ADM-06 | Student management: list with filters and search, profile tabs, add and edit, guardians linked, promotion tool, ID card PDF. (Step 3.4) | e2e/students: "admin adds a student, links guardians, makes logins…", "import 10 students… then promote the class", "teachers cannot open students or ID cards"; unit/student; db/280_student_management | ✅ |
| ADM-08 | Bulk import from Excel/CSV with template, preview and row errors. (Step 3.4) | e2e/students: "import 10 students from a CSV file…"; unit/student-import, unit/xlsx-read | ✅ |
| AUTH-04 | Guardian and student portals ("My children", "My profile"), student login by ID. (Step 3.4) | e2e/students: "guardians see their children and students their profile", "…the student logs in with the ID"; e2e/auth: role landing tests; db/140_rls_student, db/150_rls_guardian | ✅ |
| RTN-01 | Periods and working days; routine builder that blocks clashes (teacher or room); clash logic in `src/lib/routine.ts`. (Step 3.5) | e2e/routine: "admin builds a section routine; clashes block saving…", "periods: end before start is refused…"; unit/routine; db/290_routine_calendar | ✅ |
| RTN-02 | Routine views by section and by teacher ("My routine"), printable; exam schedule entity. (Step 3.5) | e2e/routine: "teachers see their own routine and cannot edit routines", "exam schedule…" | ✅ |

## Attendance, exams and results (Phase 4)

| ID | Requirement | Tests | Status |
|---|---|---|---|
| ATT-01 | Teachers take attendance for their own sections; no future dates; edits for 3 days, then admins only; mobile-first. (Step 4.1) | e2e/attendance: "a teacher marks attendance on a phone and the guardian sees it", "teachers: own sections only, no changes after 3 days"; db/310_attendance; **Day** school day | ✅ |
| ATT-02 | Monthly sheet (totals, %), print, Excel export; admin widget for today; no public attendance sheet. (Step 4.1) | e2e/attendance: "monthly sheet with totals, Excel export, and today's widget for admins"; **Day** school day | ✅ |
| ATT-03 | Student and guardian calendar of attendance with monthly %; percentage and working-day logic with holidays and leave. (Step 4.1) | e2e/attendance: "students see their own attendance; others are refused"; unit/attendance; **Day** school day | ✅ |
| EXM-01 | Exams with status flow (draft → marks entry → review → published) and exam subjects with full and pass marks per part. (Step 4.2) | e2e/marks: "admin sets up an exam…"; db/320_exams_marks; **Day** exam cycle | ✅ |
| EXM-02 | Marks entry by assigned teachers, validation, absent, autosave, submit and lock, admin unlock, Excel import. (Step 4.2) | e2e/marks: both tests; unit/marks; db/320_exams_marks, db/350_phase4_review; **Day** exam cycle | ✅ |
| EXM-03 | Grading rules (Bangladesh SSC scale, part passes, fourth subject, GPA cap, absent, ties) as pure functions. (Step 4.3) | unit/grading (38 tests, all required cases), unit/results-build | ✅ |
| EXM-04 | Process results (transaction), tabulation sheet, mark sheet and bulk PDF, merit positions. (Step 4.3) | e2e/results: "admin processes and publishes results…"; db/330_results; **Day** exam cycle | ✅ |
| EXM-05 | Publish → portal and public result search (rate-limited). (Step 4.3) | e2e/results: "…visitors and guardians see the mark sheet", "result search checks the form and says when nothing matches (Bangla)"; **Day** exam cycle | ✅ |

## Fees (Phase 5)

| ID | Requirement | Tests | Status |
|---|---|---|---|
| FEE-01 | Fee heads, structure per class and group, copy between sessions, waivers approved by an admin, late fine settings. (Step 5.1) | e2e/fees: all 3 tests; unit/fees; db/360_fees_setup, db/390_phase5_review; **Day** fee month | ✅ |
| FEE-02 | Invoice generator: preview and make, idempotent, money in poisha. (Step 5.1) | e2e/fees: "…invoices are made once"; unit/fees (planInvoices); db/360, db/390; **Day** fee month | ✅ |
| FEE-03 | Collect screen: find a student, tick items, method and transaction ID, part payments, receipt with words and QR, cancel by admin. (Step 5.2) | e2e/collection: all 4 tests; unit/collection, unit/review-phase-5; db/370_fee_collection, db/390; **Day** fee month | ✅ |
| FEE-04 | Reports: daily collection, dues by class/section/month with guardian phone, income by fee for dates, student ledger; Excel and PDF. (Step 5.2) | e2e/coverage-gaps: "dues by class show who owes what…", "income by fee for a date range, and the student ledger", "reports download as Excel and PDF; teachers cannot…" (**new**); e2e/collection (daily); unit/collection (ledger), unit/collection (report tables); **Day** fee month | ✅ |
| FEE-05 | Payment gateway interface; manual and sandbox providers; webhook verifies, idempotent, records; Pay now only when switched on. (Step 5.3) | e2e/online-payment: both tests; unit/payments; db/380_online_payments, db/390 | ✅ |
| FEE-06 | Step 5.2 (shared): accountant widgets, family portal fees, RLS (guardians see own, teachers none). | e2e/collection: "families see their fees; teachers see no fees or receipts", "the accountant's home shows the collection"; e2e/coverage-gaps exports (**new**); db/370, db/130_rls_accountant | ✅ |

## Non-functional

| ID | Requirement | Tests | Status |
|---|---|---|---|
| NFR-01 | Security: RLS everywhere, roles on server and database, no service key in the browser. (Step 6.2) | db/090_rls_coverage, db/100–160 RLS suites, db/010_schema (fixed search_path); unit/security-rules, unit/supabase-admin, unit/security-audit; db/400_security_audit; e2e/security-headers; `scripts/check-bundle-secrets.mjs` in CI; `docs/security-report.md` | ✅ |
| NFR-02 | Privacy and abuse limits: no personal data on public pages, rate limits, safe uploads. (Step 6.2) | e2e/people and e2e/staff (no NID, birth date or address); e2e/auth (login limits); e2e/people (contact limit); e2e/cms (fake PDF refused); e2e/dashboard (logo checked by content); e2e/privacy-crawl (whole public site, en and bn); e2e/students (switched-off login blocked in the API) | ✅ |
| NFR-03 | Performance (Lighthouse ≥ 90). (Step 6.3) | Run in 6.3. | ⏳ 6.3 |
| NFR-04 | Accessibility (axe, keyboard, contrast). (Step 6.3) | Partly: e2e/home (keyboard menu), e2e/content (lightbox keys). axe in 6.3. | ⏳ 6.3 |
| NFR-06 | Mobile (360px) and print. (Step 6.3) | e2e/smoke, e2e/dashboard ("dashboard works on a phone… no sideways scrolling"), every spec on mobile-360. Print styles in 6.3. | ⏳ 6.3 |

## IDs with no text supplied

WEB-10, WEB-13, ADM-05, ADM-07 and NFR-05 fall between cited numbers but are never described, so there is nothing to test. If the catalogue lists them, they will be added.

## Requirements with no test

None of the cited IDs is left without a test. The gaps found at the start of Step 6.1 were filled in `tests/e2e/coverage-gaps.spec.ts`:
- FEE-04 dues, income and ledger reports and their exports;
- the News module of WEB-07/08.

NFR-01…06 and WEB-17 are covered in full by Steps 6.2 and 6.3, as the requirements plan.
