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
   per-student fourth subject on `enrollments`.
11. Fees: `fee_heads`, `fee_structures`, `invoices`, `payments`.
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

---

## Open questions
1. **Public results (1.3):** should anon see results by roll number lookup only, or a full
   list? Showing all students' marks publicly may conflict with the privacy rule.
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
30. **Reference site:** www.cpghs.edu.bd is blocked by this environment's network policy;
   website modules above are a typical set and should be checked against it.
