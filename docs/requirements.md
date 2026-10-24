# Edumise BD — Requirements

Status legend: **[CONFIRMED]** = text supplied by the product owner, verbatim.
**[DRAFT]** = written by Claude from the brief and later steps; needs owner review
before it is built.

---

## Stakeholders and user roles [DRAFT]

| Role | Who | Scope |
|---|---|---|
| `anon` | Public visitor | Published website content only |
| `super_admin` | Vendor / school IT | Everything, incl. school settings, role assignment, user management |
| `admin` | Headteacher, office staff | All academic, website and people data; cannot change super_admin users |
| `teacher` | Subject / class teacher | Own sections and subjects |
| `accountant` | Accounts office | Fees full; students read-only |
| `student` | Enrolled student | Own data only |
| `guardian` | Parent / guardian | Linked students' data only |

R = read, W = create/update/delete, — = no access.

| Data | anon | super_admin | admin | teacher | accountant | student | guardian |
|---|---|---|---|---|---|---|---|
| Website content (notices, events, pages, sliders, gallery, downloads) | R published | RW | RW | R | R | R | R |
| `school_settings` | R public fields | RW | R | R | R | R | R |
| `public_staff`, `governing_body` | R | RW | RW | R | R | R | R |
| `profiles` | — | RW | RW (not super_admin rows) | R own | R own | R own | R own |
| Academic setup (years, classes, sections, subjects) | — | RW | RW | R | R | R | R |
| `routine` | R | RW | RW | R | R | R | R |
| `staff` (private: NID, DOB, address, phone) | — | RW | RW | R own | R own | — | — |
| `teacher_assignments` | — | RW | RW | R own | — | — | — |
| `students` (private fields) | — | RW | RW | R own sections | R | R own | R linked |
| `guardians`, `student_guardians` | — | RW | RW | R own sections | R | R own | R own |
| `attendance` | — | RW | RW | RW own sections | — | R own | R linked |
| `exams`, `exam_subjects` | R published | RW | RW | R | — | R | R |
| `marks` | R published exam | RW | RW | RW own subjects while not locked | — | R own | R linked |
| Fees (`fee_heads`, `fee_structures`, `invoices`, `payments`) | — | RW | RW | — | RW | R own | R linked |

---

## Step 1.1: project setup [DRAFT]
- Next.js 15 (App Router, TS strict, `src/` dir), Tailwind v4, shadcn/ui init, lucide-react.
- ESLint + Prettier; scripts: `dev`, `build`, `lint`, `typecheck`, `test` (Vitest),
  `test:e2e` (Playwright), `db:start`, `db:reset`, `db:test`, `db:types`.
- Minimal `[lang]` segment (`en`, `bn`) and empty `en.json` / `bn.json` so later steps have
  a place to put strings (full i18n is Step 1.5).
- Supabase local project (`supabase init`), `src/lib/supabase/{server,browser,admin}.ts`;
  `admin.ts` imports `server-only`.
- `.env.example`; GitHub Actions CI running lint, typecheck, unit tests, build.

Acceptance: `/en` renders a placeholder page; all four npm checks pass; one sample unit
test and one sample Playwright test run.

## Step 1.2: database schema and seed [DRAFT]
Migrations (one file per area):
1. Enums: `app_role`, `gender`, `attendance_status`, `payment_method`, `invoice_status`.
2. `school_settings` (single row: name_en/bn, address_en/bn, logo_path, primary/secondary colour,
   phone, email, social links, EIIN, institution code, center code, established year,
   head teacher message_en/bn + photo).
3. `profiles` (id → auth.users, role, full_name_en/bn, must_change_password).
4. Academic: `academic_sessions` (is_current, only one), `classes` (6–10), `sections`
   (capacity, class_teacher_id), `groups` (Science, Business Studies, Humanities),
   `subjects` (code, name_en/bn, type compulsory/optional/fourth), `class_subjects`
   (class, group nullable, subject).
5. People: `staff` (private fields: nid, birth_date, address, personal_phone),
   `students` (roll, section, private fields), `guardians`, `student_guardians`,
   `teacher_assignments` (teacher, section, subject; `is_class_teacher`).
6. Public people: `designations` (name_en/bn, rank), `public_staff` (view exposing only photo,
   name, designation, subjects, qualification, joining year, bio, is_current),
   `governing_body` (term_start/end, is_current), `ex_principals`.
   Contact: `contact_messages` (is_read, ip_hash for rate limiting).
   Admission: `admission_applications` (tracking_no, status, test date/marks),
   `admission_documents`, `tracking_counters`; `enrollments` (student, session, section,
   roll); `audit_log`.
7. Website: `notices` (category, audience, target class, is_pinned, attachment), `news`,
   `events`, `event_photos`, `pages`, `sliders`, `gallery_albums`, `gallery_images`,
   `downloads`, `menu_items` (parent_id, label_en/bn, href, sort_order), `quick_links`,
   `footer_links` — all with `_en`/`_bn` columns and `is_published` / `published_at`.
8. `periods` (number, start/end, is_break), working days in `school_settings`, `rooms`,
   `routine` (session, section, day, period, subject, teacher, room),
   `exam_schedules` (exam, date, subject, start/end), `calendar_entries` (date range,
   type holiday/event, title_en/bn).
9. `attendance` (student, date, status, marked_by; unique student+date).
10. Exams: `exams` (session, status draft/marks_entry/review/published, schedule_published),
   `exam_classes`, `exam_subjects` (class, subject, CQ/MCQ/practical full + pass marks,
   counts_in_gpa, locked), `marks` (student, exam_subject, cq, mcq, practical, is_absent),
   per-student fourth subject on `enrollments`; `results` (per student per exam: GPA,
   GPA without fourth, grade, total, pass/fail, section + class position),
   `result_subjects`; `board_results` (year, exam, examinees, passed, gpa5).
   Certificates: `certificates` (ref_no, student, type, language, issued_at, issued_by,
   status valid/revoked, revoked_reason).
11. Fees (all amounts `bigint` poisha): `fee_heads` (type monthly/one_time), `fee_structures`
   (session, class, group nullable, head, amount), `fee_waivers` (student, head, percent or
   fixed, reason, approved_by), `invoices` (student, period, due_date, status),
   `invoice_items` (head, period key, gross, waiver, net; unique student+head+period),
   `payments` (receipt_no, method, txn_id unique when set, collected_by, status
   active/cancelled, cancel_reason), `payment_allocations` (payment → invoice_item, amount),
   `payment_intents` (provider, provider_txn_id unique, amount, status); late fine and
   `online_payment_enabled` in `school_settings`.
- Storage buckets: `public-media` (public), `private-docs` (private).
- `seed.sql`: fictional school "Sunrise High School"; one auth user per role (6),
  2 classes × 2 sections, students, guardians, a published and an unpublished exam,
  notices (some unpublished), fees.
- `npm run db:types` → `src/lib/supabase/database.types.ts`.

Acceptance: `npm run db:reset` applies all migrations + seed with no errors; types generate;
typecheck passes.

## Step 1.3: RLS policies [CONFIRMED]
Add RLS policies for every table, following the role matrix in docs/requirements.md
(section "Stakeholders and user roles").
- Helper SQL functions (security definer, stable): auth_role(), is_staff(), is_admin(),
  teacher_section_ids(), guardian_student_ids(), my_student_id().
- Store the role in profiles; also add it to the JWT via a custom access token hook so
  middleware can read it without a query.
- Public (anon) can read only published website content, public_staff, governing_body,
  routine, and results only where exam is published.
- Teachers: read students in their sections, write attendance for their sections and marks
  for their subjects; marks locked once exam_subjects.locked = true.
- Guardians: only their linked students' data. Students: only their own.
- Accountant: fees tables full, students read-only.
- Write pgTAP tests in supabase/tests/ that log in as each seeded role and prove: allowed
  reads/writes succeed and forbidden ones fail (at least 3 negative tests per role).

Acceptance: npm run db:test passes; no table has RLS disabled (add a test that checks
pg_tables for rowsecurity = false in public schema).

## Step 1.4: authentication [CONFIRMED]
- /[lang]/login page: email or phone + password, error messages, loading state.
- Forgot password and reset password pages (Supabase email flow).
- Force password change on first login (profiles.must_change_password).
- Middleware protects /[lang]/dashboard/**; redirect unauthenticated users to login.
- Dashboard layout with sidebar + top bar, sidebar items generated from a typed config
  filtered by role; a role-specific home page (placeholder widgets) for each of the 6 roles.
- requireRole(roles[]) server helper used in layouts and server actions.
- Logout.
- Unit tests for the nav config filter; Playwright test: each seeded role logs in, lands on
  its own dashboard, and gets 403/redirect when opening another role's page.

Acceptance: all 6 seeded users can log in; wrong password shows an error; protected routes
are blocked when logged out.

## Step 1.5: i18n and white-label theme [CONFIRMED]
- [lang] segment with en and bn; middleware redirects / to the preferred language
  (cookie, then Accept-Language, default en).
- getDictionary(lang) with typed keys; a t() helper; language switch component that keeps
  the current path.
- src/lib/format.ts: toBanglaDigits, formatDate(lang), formatCurrency(BDT, lang),
  pickLocalized(row, 'title', lang) with English fallback. Full unit tests.
- Fonts: Inter for en, Hind Siliguri (next/font) for bn, applied by lang attribute.
- Theme colours read from school_settings and applied as CSS variables; logo and school
  name from settings everywhere.
- Admin page /dashboard/settings to edit school_settings (Zod-validated server action,
  logo upload to public-media bucket).

Acceptance: switching language on any page keeps the path; dates and numbers show Bangla
digits in bn; changing the primary colour in settings changes the site colour.

## Step 2.1: public site shell and home page (WEB-01, WEB-02, WEB-16) [CONFIRMED]
- Top bar: phone, email, social icons (from settings, hidden if empty), language switch,
  "Apply Online" and "Login" buttons.
- Header with logo + school name and a responsive mega-menu built from menu_items
  (desktop dropdowns, mobile sheet). Menus: Home, About, Information, Academic, Admission,
  Student, Facilities, Result, Others, Contact.
- Footer: address, contact, configurable govt/education links, social links, copyright.
- Home sections (each its own server component, hidden automatically when empty):
  hero carousel, scrolling notice ticker + latest 5 notices, institute facts (EIIN,
  institution code, center code, established), quick-link grid, head teacher's message,
  teacher highlights (from public_staff), live counters (classes, students, teachers, staff
  counted from DB), class-wise student bar chart, upcoming events, gallery preview.
- Use ISR: revalidate with revalidateTag when content changes.
- Design: clean, modern, trustworthy; primary colour from settings; good on 360px.
- E2E: home loads in en and bn, no broken links in header/footer (crawl and assert 200).

## Step 2.2: CMS pages and menu (WEB-03, WEB-04) [CONFIRMED]
- Public route /[lang]/p/[slug] renders pages (title, rich content, cover image, attachments).
- Seed pages for every static menu item in the reference site: about-us, history, donors,
  mission-vision, campus-tour, achievements, chairman-message, principal-message,
  administrators, recognition-letter, nationalization, statistics, govt-approval,
  academic-rules, academic-calendar, why-study, how-to-apply, admission-test,
  admission-policy, registration-system, tuition-fees, mobile-banking, daily-activities,
  uniform, exam-system, rules, library, playground, physics-lab, chemistry-lab,
  biology-lab, ict-lab, co-curricular.
- Dashboard (admin): Pages list (search, status draft/published), editor with EN/BN tabs,
  rich text editor (Tiptap) with sanitised HTML output, image upload, SEO title/description.
- Menu builder: tree editor (add, rename EN/BN, reorder via drag or up/down, link to page or
  URL, hide). Items pointing to empty/unpublished pages are hidden on the site automatically.
- Tests: HTML sanitiser unit test (strips script/onerror); E2E: admin edits a page in bn,
  publishes, public page shows new text.

## Step 2.3: dynamic content modules (WEB-07, WEB-08, WEB-14, NOT-01) [CONFIRMED]
For each module build: public list page with search + filters + pagination, public detail
page, and dashboard CRUD with EN/BN fields, draft/publish, publish date, file upload.
- Notices: category (general, exam, result, admission, holiday), audience (public, staff,
  class), pin to top, PDF/image attachment with inline PDF preview and download,
  share buttons (Facebook, WhatsApp, X, copy link). Teachers can create notices (draft);
  admin publishes.
- News: cover image, body.
- Events: date/time, venue, photos; upcoming vs past tabs.
- Gallery: albums with cover, photos uploaded in bulk (client-side resize to max 1600px,
  WebP), lightbox with keyboard navigation and captions.
- Downloads: category, file, size and type shown.
- Every detail page gets Open Graph metadata. Add sitemap.ts and robots.ts.
- Tests: unit test for slug/date helpers; RLS test: drafts invisible to anon;
  E2E: create notice as draft -> not visible; publish -> visible on home ticker and list.

## Step 2.4: people and contact pages (WEB-05, WEB-06, WEB-15) [CONFIRMED]
- Teachers and Staff directory: current and former, grouped/ordered by designation rank
  (Head Teacher, Assistant Head Teacher, Senior Teacher, Assistant Teacher, Instructor, Staff),
  cards with photo, name, designation, subject. Profile page shows ONLY public fields
  (photo, name, designation, subjects, qualification, joining year, short bio).
- Governing body and ex-governing body grouped by term; ex-principals list.
- Dashboard CRUD for governing body and ex-principals.
- Contact page: form (name, phone, email, subject, message) with Zod validation,
  honeypot + rate limit (5/hour per IP), saves to contact_messages; Google Maps embed from
  settings; office hours. Admin inbox page to read/mark messages.
- Tests: E2E asserts a staff profile page HTML does not contain the seeded NID, birth date
  or address; contact form validation errors show in both languages.

## Step 3.1: academic structure management (admin) [CONFIRMED]
- Dashboard pages: Sessions (set one as current), Classes, Sections (per class, capacity,
  class teacher), Groups (Science, Business Studies, Humanities), Subjects (code, name EN/BN,
  type: compulsory / optional / fourth), Class-Subjects mapping per class and group.
- Reusable DataTable component (TanStack): search, column filters, sort, pagination,
  CSV export, row actions, empty and loading states. Use it everywhere from now on.
- Reusable FormDialog pattern with react-hook-form + Zod + server action + toast.
- Tests: unit tests for Zod schemas; E2E: create session -> class -> section -> map subjects.

## Step 3.2 [MISSING]
Not supplied yet. Step 3.3 needs `enrollments` and a class list, which likely belong here.

## Step 3.3: online admission (ADM-01 to ADM-04) [CONFIRMED]
Public /[lang]/admission/apply multi-step form (progress bar, saves draft in localStorage):
 1) Student: name EN/BN, birth date, gender, birth registration no, religion, blood group,
    photo (jpg/png <= 500KB, cropped square).
 2) Guardian: father, mother, local guardian name, phone (BD format 01XXXXXXXXX validated),
    occupation, email, addresses.
 3) Academic: applying for class, group (only Class 9), previous school, last result.
 4) Documents: birth certificate, previous transcript (pdf/jpg <= 2MB).
 5) Review + declaration checkbox + submit.
- On submit: insert via server action using admin client (anon cannot write directly),
  upload files to private documents bucket, generate tracking no ADM-YYYY-00001,
  show success page with printable application copy (PDF).
- /[lang]/admission/status: check by tracking no + phone.
- Dashboard Admissions: queue with filters (class, status, date), detail view with
  documents, change status, schedule test, enter test marks, merit list per class.
- "Approve" converts to student + guardian + enrollment (choose section, auto-assign next
  roll), creates guardian login, records in audit_log. Wrap in a single DB function
  (transaction).
- Tests: unit tests for phone/birth-reg validators and tracking no generator; RLS: anon
  cannot read applications; E2E full flow apply -> approve -> student appears in class list.

## Step 3.4: student management (ADM-06, ADM-08, AUTH-04) [CONFIRMED]
- Students list with filters (session, class, section, group, status) and search by
  name/ID/roll/phone; student profile with tabs: Overview, Guardians, Academic history,
  Attendance (placeholder), Results (placeholder), Fees (placeholder), Documents.
- Add/edit student manually; link multiple guardians; one guardian can have many children.
- Bulk import from Excel/CSV: download template, upload, preview with row-level validation
  errors, then commit. Use SheetJS.
- Year-end promotion tool: pick session + class, mark promoted/retained per student,
  creates next-session enrollments with new rolls.
- Student ID card PDF (front/back, photo, QR with student ID) using @react-pdf/renderer.
- Guardian and student portal pages: "My children" / "My profile".
- Tests: unit tests for CSV row validation and roll assignment; E2E import 10 students.

## Step 3.5: routine (RTN-01, RTN-02, WEB-09) [CONFIRMED]
- Periods setup (number, start/end time, break flag) and working days (Sat-Thu default).
- Routine builder: grid of days x periods for a section; each cell pick subject + teacher
  (+ room). Block on save and highlight clashes: same teacher or room in two places at the
  same time. Clash logic lives in src/lib/routine.ts with unit tests.
- Views: by section, by teacher ("My routine" for teachers), printable A4 landscape.
- Exam schedule entity (exam, date, subject, time) with public view.
- Academic calendar: holidays and events by month; public calendar page.
- Public /[lang]/routine with class + section selector.

## Step 4.1: student attendance (ATT-01, ATT-02, ATT-03) [CONFIRMED]
- Teacher page "Take attendance": pick section (only own sections) and date (default
  today, no future dates, edits allowed for 3 days then admin only). Mobile-first list with
  big tap targets; default all Present; tap to cycle Present/Absent/Late/Leave; "mark all";
  sticky Save bar with counts. Upsert in one server action.
- Monthly sheet: section x month grid (P/A/L/Lv), totals and % per student, print A4
  landscape, export Excel. Public /attendance_sheet is NOT exposed (privacy) - remove it.
- Student/guardian portal: calendar view of the child's attendance + monthly %.
- Admin dashboard widget: today's attendance % per class, list of sections not yet marked.
- src/lib/attendance.ts: percentage, working days (exclude holidays from calendar),
  streak of absences. Unit tests incl. holidays and leave not counted as absent.
- Tests: RLS teacher cannot mark another section; E2E teacher marks attendance on a
  360px viewport and guardian sees it.

## Step 4.2: exams and marks (EXM-01, EXM-02) [CONFIRMED]
- Exams: name EN/BN (Half Yearly, Annual, Pre-test, Test, Model), session, classes,
  start/end date, status draft -> marks_entry -> review -> published.
- Exam subjects per class: full and pass marks for CQ, MCQ, practical; total full marks;
  whether it counts in GPA; fourth-subject flag per student group.
- Marks entry: teacher picks exam + section + subject (only their assignments), grid of
  students with inputs per part, validates 0..full marks, "absent" checkbox, autosave
  draft, "Submit & lock". Admin can unlock. Show completion status per subject for admin.
- Bulk import marks from Excel template.
- Tests: RLS teacher cannot write marks for other subjects or after lock; validation unit
  tests; E2E enter and lock marks.

## Step 4.3: grading and results (EXM-03, EXM-04, EXM-05) [CONFIRMED]
Business logic must be pure
functions in src/lib/grading.ts with exhaustive unit tests (aim 100% coverage).
Rules (Bangladesh SSC scale; read thresholds from school_settings.grading so it is
configurable):
  80-100 A+ 5.00 | 70-79 A 4.00 | 60-69 A- 3.50 | 50-59 B 3.00 | 40-49 C 2.00 |
  33-39 D 1.00 | 0-32 F 0.00
- Percent per subject = obtained / full * 100. Must also pass each part (CQ, MCQ,
  practical) separately where pass marks are set; failing a part = F for the subject.
- Fail (F) in any compulsory subject -> overall result Fail, GPA 0.00.
- Fourth subject: only grade points above 2.00 are added (gp - 2).
- GPA = (sum of compulsory GPs + fourth bonus) / number of compulsory subjects, capped at
  5.00, rounded to 2 decimals. GPA without fourth subject also stored.
- Absent in a subject = F.
- Merit position within section and class: by total GPA, then total marks, then roll
  (document tie rule).
Then:
- "Process results" action (admin) computes results rows for an exam in a DB transaction.
- Tabulation sheet (section x subjects), report card / mark sheet PDF (school header,
  photo, subject table, GPA, grade, position, attendance %, class teacher and head teacher
  signature lines), bulk PDF for a section.
- Publish exam -> results visible in student/guardian portal and public search.
- Public /[lang]/result: select session, exam, class, section, group + roll -> mark sheet,
  printable. Rate-limited. Board exam results page (WEB-11): admin enters year, examinees,
  passed, GPA-5 count; public table + line chart of pass rate by year.
- Test cases to include at minimum: all A+; one subject 32 -> Fail; CQ passed but MCQ
  failed -> F; fourth subject A+ adds 3.00; GPA cap at 5.00; absent; tie ranking.

## Step 4.4: certificates (WEB-12) [CONFIRMED]
- Admin issues testimonial / transfer / character certificate for a student from templates
  (EN/BN), each with a unique reference no and QR code linking to
  /[lang]/verify/[ref]. PDF generation.
- Public Verify page + header popup: enter reference no -> shows student name, certificate
  type, issue date, status (valid/revoked). Show no other personal data.
- Tests: E2E issue -> verify valid -> revoke -> verify shows revoked.

## Phase 5 — Fees and payments [CONFIRMED]
Goal: the accountant bills students, records payments and sees dues; guardians see their
invoices. Online payment is prepared but switched off until a gateway account exists.

## Step 5.1: fee structure and invoices (FEE-01, FEE-02) [CONFIRMED]
- Fee heads (Admission, Session, Monthly Tuition, Exam, Lab, ICT, Sports, Transport...),
  type monthly or one-time, EN/BN names.
- Fee structure: class (+ optional group) x head x amount per session; copy from previous
  session.
- Waivers/discounts per student: percent or fixed, per head, reason, approved by admin
  (full free, half free, sibling discount).
- Invoice generator: pick session, month (for monthly heads) or exam/one-time head,
  classes -> preview count and total -> generate invoices with items after waivers.
  Idempotent: never duplicate an invoice for the same student+head+period.
- Optional late fine after due date (configurable amount/day, cap).
- All money as integer poisha (BDT x 100) in DB; format in UI.
- src/lib/fees.ts: apply waivers, compute totals, late fine, invoice status from payments.
  Exhaustive unit tests (rounding, 100% waiver, partial payments, overpayment rejected).

## Step 5.2: collection and reports (FEE-03, FEE-04, FEE-06) [CONFIRMED]
- Collect fee screen (accountant): search student by ID/roll/name -> shows unpaid invoices
  -> select items -> amount, method (cash, bKash, Nagad, Rocket, bank), transaction ID
  (required for mobile banking, unique) -> save -> receipt PDF (receipt no, items, paid,
  due, in words in EN/BN, QR). Partial payments allowed; allocate to oldest first.
- Cancel a payment with reason (admin only), keeps audit_log; never hard delete money rows.
- Reports: daily collection (by method, by collector), dues by class/section/month with
  guardian phone, head-wise income for a date range, student ledger. Export Excel and PDF.
- Accountant dashboard widgets: today's collection, this month vs last month, top dues.
- Guardian/student portal: invoices, payments, download receipts, total due banner.
- Tests: RLS guardian sees only own children's invoices, teacher sees no fee data;
  E2E generate invoices -> collect partial -> invoice status partial -> collect rest ->
  paid -> guardian sees receipt.

## Step 5.3: payment gateway abstraction (FEE-05, phase-2 ready) [CONFIRMED]
- Define a PaymentProvider interface (createPayment, verifyPayment, handleWebhook) in
  src/lib/payments/. Implement a "manual" provider and a "sandbox" mock provider; leave
  stubs with TODO for bkash, nagad, sslcommerz.
- Guardian "Pay now" button only shows when settings.online_payment_enabled = true.
- Webhook route /api/payments/webhook/[provider] verifies signature, is idempotent
  (payment_intents table, unique provider txn id), then records the payment.
- Tests: unit tests for idempotency and amount mismatch rejection using the mock provider.

## Phase 6 — QA, security, performance and launch [CONFIRMED]
Goal: prove the whole system works end to end, fix what fails, and deploy.

## Step 6.1: full regression and traceability [CONFIRMED]
Act purely as a QA lead. Do not add features.
1. Build docs/traceability.md: every requirement ID from docs/requirements.md -> the
   test file(s) and test names covering it -> status. List every requirement with no test.
2. Write the missing tests (unit, RLS or Playwright) so every M and S requirement is
   covered.
3. Write 5 end-to-end "day in the life" Playwright scenarios: admission season, a school
   day (attendance), exam cycle (setup -> marks -> process -> publish -> public search),
   fee month (invoice -> collect -> dues report), website editor (notice + page + gallery).
   Run them in desktop Chrome and a 360x740 mobile viewport, en and bn.
4. Run the entire suite. For each failure, log it in docs/qa-report.md with ID, severity
   (Blocker/Major/Minor/Cosmetic), requirement ID, steps, expected, actual.
5. Fix Blockers and Majors one by one, re-run, and update the report. Stop and show me the
   report before fixing Minors.

## Step 6.2: security audit (NFR-01, NFR-02) [CONFIRMED]
Act as a penetration tester on our own code. Check and fix:
- Any table/view/function without RLS or with an overly broad policy; any SECURITY DEFINER
  function without a fixed search_path. Run Supabase advisors (supabase db lint).
- Service-role key or secrets reachable from client bundles (grep the .next build output).
- Every server action and route handler: auth check, role check, Zod validation.
- IDOR: try changing IDs in URLs/actions for another student, invoice, application.
- File uploads: type + size checked server-side, private bucket uses signed URLs.
- XSS via rich text and notice titles; CSRF on route handlers; rate limits on login,
  contact, admission and result search.
- Personal data on public pages: crawl the whole public site and assert no NID, birth date,
  guardian phone or address appears.
- Security headers (CSP, X-Frame-Options, Referrer-Policy) in next.config.
Write findings and fixes to docs/security-report.md, with a regression test for each fix.

## Step 6.3: performance, accessibility and SEO (NFR-03, NFR-04, NFR-06, WEB-17) [CONFIRMED]
- Run Lighthouse (mobile) on home, notice list, notice detail, result page, teacher list;
  target >= 90 for Performance, Accessibility, Best Practices, SEO. Fix issues: next/image
  sizes, font loading, bundle size (analyze), caching, unused JS.
- Run axe via @axe-core/playwright on every public page and the main dashboard pages;
  fix all serious/critical violations.
- Check every dashboard screen at 360px for overflow; tables scroll horizontally.
- Verify print styles for report card, receipt, attendance sheet, routine.
- Add Lighthouse CI to GitHub Actions for the home page.
Record before/after scores in docs/qa-report.md.

---

## Open questions
1. ~~**Public results (1.3):**~~ RESOLVED by 4.3: lookup by session/exam/class/section/
   group + roll, rate-limited. Draft: anon gets results only through a function that
   returns one mark sheet, not by reading the `results` table directly.
2. **public_staff (1.3):** separate table maintained by admin, or a view exposing only safe
   columns of `staff`? (Draft assumes a view.)
3. **Phone login (1.4):** Supabase phone+password needs phone auth enabled. Alternative:
   look up the email for a phone number server-side, then sign in with email. Which?
4. **Step order:** 1.4 (login, dashboard) comes before 1.5 (i18n). Should 1.4 build its
   pages with plain dictionary lookups, then switch to `t()` in 1.5? Or build 1.5 first?
5. **school_settings columns:** 1.5 needs theme colours (primary, maybe secondary/accent).
   Draft 1.2 will include `primary_color`, `secondary_color`, `logo_path`.
6. **Counters (2.1):** the home page shows live student/teacher counts from private
   tables. Draft: a `security definer` function returning only the counts to anon.
7. **Requirement IDs:** 2.1 cites WEB-01, WEB-02, WEB-16. Is there a list of all IDs
   (WEB-xx and others) to paste?
8. **Menu tree (2.2):** which of the 33 seeded pages sit under which of the 10 top menus?
   Draft grouping will follow the slugs (e.g. physics-lab under Facilities) unless you paste
   the reference site's menu.
9. **Notice audience (2.3):** draft rule: `public` = anon; `staff` = staff roles only;
   `class` = staff plus students/guardians of that class, shown in the dashboard only.
   This also changes the Step 1.3 notice policies. Correct?
10. **Teacher notice edits (2.3):** can a teacher edit or delete their own draft after
   submitting it, and what happens if admin unpublishes it? Draft: own drafts only.
11. **Rate limit (2.4):** no Redis in the stack. Draft: count rows in `contact_messages`
   by a salted hash of the IP over the last hour (raw IPs are not stored). OK?
12. **Groups (3.1):** in Bangladesh groups usually start in Class 9. Draft: groups apply to
   Classes 9–10 only; Classes 6–8 map subjects with no group. Correct?
13. **Step 3.2:** it was skipped. Please paste it.
14. **Guardian login (3.3):** how does the guardian receive the new account's password?
   Draft: login is the guardian's phone, a one-time password is shown on the approval
   screen to print or hand over, and `must_change_password` is set. No SMS provider.
15. **Student login (3.3):** approval creates a guardian login. Should it also create a
   student login?
16. **Birth registration no (3.3):** draft rule is exactly 17 digits (current BD format).
17. **Admission statuses (3.3):** draft: submitted, under_review, test_scheduled,
   approved, rejected, waitlisted.
18. **Student ID format (3.4):** draft: `YYYY` + class + 4-digit serial, e.g. `2026060012`,
   unique for life and printed on the ID card QR.
19. **Promotion rolls (3.4):** new rolls by merit (final exam result, needs Step 4.x) or keep
   the old order? Draft: by merit when a final result exists, otherwise by previous roll.
20. **SheetJS (3.4):** the npm `xlsx` package is outdated and has known vulnerabilities;
   SheetJS now ships from cdn.sheetjs.com. Draft: install the current version from that
   URL (needs network access to cdn.sheetjs.com).
21. **Rooms (3.5):** a managed `rooms` list, or free text per cell? Clash checks need the
   same room spelled the same way, so draft is a managed list.
22. **Exam schedule visibility (3.5):** `exams.is_published` (1.3) is about results. The
   schedule must go public before results. Draft: separate `schedule_published` flag.
23. **Clash scope (3.5):** clashes checked within the current session only? Draft: yes.
24. **Attendance % (4.1):** draft formula: (Present + Late) / (working days − Leave days).
   Late counts as attended; Leave is removed from the denominator, not counted as absent.
   Correct?
25. **3-day edit window (4.1):** calendar days or working days? Draft: 3 calendar days
   after the date, enforced in RLS as well as the server action.
26. **Excluded on purpose:** no public attendance sheet page (the reference site has one).
27. **Exam status vs 1.3 (4.2):** Step 1.3 says "exam is published". Draft: published means
   `status = 'published'`; the 1.3 policies use that instead of a boolean.
28. **Fourth subject (4.2):** where is each student's fourth-subject choice stored? Draft:
   `enrollments.fourth_subject_id`, set in Class 9 per group.
29. **Lock scope (4.2):** "Submit & lock" locks one exam_subject for one section, but
   `exam_subjects` is per class. Draft: a lock per exam_subject + section
   (`mark_locks` table), so one teacher's submit does not lock other sections.
30. **Percent rounding (4.3):** the scale uses whole numbers. Is 79.5% an A or an A+?
   Draft: compare the exact percentage, no rounding (79.5 → A; 80 → A+).
31. **Optional (non-fourth) subjects (4.3):** 3.1 has type compulsory / optional / fourth.
   Do "optional" subjects count in GPA? Draft: only if `counts_in_gpa` is true, and then
   they are treated as compulsory.
32. **Two-paper subjects (4.3):** Bangla and English have 1st and 2nd papers in BD and are
   graded as one combined subject. Draft: a `paper_group` on subjects; marks of both papers
   are summed before grading. Needed?
33. **Merit GPA (4.3):** rank by GPA *with* the fourth subject? Draft: yes; failed students
   are ranked after all passed students.
34. **Certificate reference no (4.4):** a sequential number (CERT-2026-00001) lets anyone
   step through numbers and collect student names. Draft: random 10-character code
   (e.g. `TC-7KQ2-M9XA-4P`), verify lookup rate-limited like results.
35. **Certificate templates (4.4):** fixed layouts with fields filled from the student
   record, or admin-editable template text? Draft: fixed layouts; admin can edit the
   body text per certificate before issuing.
36. **Transfer certificate (4.4):** should issuing one mark the student as transferred /
   inactive? Draft: yes, with a confirmation step.
37. **Waiver rounding (5.1):** percent waivers can give fractions of a poisha. Draft: round
   the waiver *down* to the whole poisha (school never under-charges by rounding).
38. **Stacking waivers (5.1):** a student with half-free and a sibling discount on the same
   head: apply both? Draft: percent waivers first, then fixed; net never below 0.
39. **Late fine (5.1):** stored on the invoice when charged, or computed live? Draft:
   computed live for display; frozen onto the invoice as a fine item when a payment is
   recorded. Applies per invoice, not per item.
40. **Allocation (5.2):** "select items" and "allocate to oldest first" together. Draft: the
   accountant ticks items; a partial amount is spread over the ticked items oldest due
   date first, fine items before the fee itself.
41. **Cancelled payments (5.2):** cancelling restores the invoice to unpaid/partial and
   keeps the receipt number (marked CANCELLED on reprint). Receipt numbers are sequential
   per year (`RCP-2026-000123`) since receipts are not public. OK?
42. **Mobile banking txn ID (5.2):** unique per method (bKash and Nagad IDs could clash)?
   Draft: unique on (method, txn_id).
43. **Requirement catalogue (6.1):** 6.1 traces "every requirement ID" and covers "every M
   and S requirement" (MoSCoW priority). The steps cite IDs (WEB-01…16, NOT-01, ADM-01…08,
   AUTH-04, RTN-01/02, ATT-01…03, EXM-01…05, FEE-01…06) but the list of IDs with their
   text and M/S/C/W priority has not been supplied. Please paste it; without it 6.1 can
   only trace the IDs cited in the steps.
44. **CSP vs ISR (6.2 vs 2.1):** a strict nonce-based CSP forces every page to render on each
   request, which turns off the ISR caching required in 2.1. Draft: a static CSP in
   next.config (no nonces; `script-src 'self'` plus hashes where needed), keeping ISR.
   A strict nonce CSP only on the dashboard, which is dynamic anyway.
45. **Guardian phone in reports vs privacy (6.2):** dues reports (5.2) show guardian phone.
   Fine for staff; draft treats the rule as "never on public pages" only.
46. **Reference site:** www.cpghs.edu.bd is blocked by this environment's network policy;
   website modules above are a typical set and should be checked against it.
