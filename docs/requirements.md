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
4. Academic: `academic_years`, `classes` (6–10), `sections`, `subjects`, `class_subjects`.
5. People: `staff` (private fields: nid, birth_date, address, personal_phone),
   `students` (roll, section, private fields), `guardians`, `student_guardians`,
   `teacher_assignments` (teacher, section, subject; `is_class_teacher`).
6. Public people: `public_staff` (view or table of non-private staff fields), `governing_body`.
7. Website: `notices`, `events`, `pages`, `sliders`, `gallery_albums`, `gallery_images`,
   `downloads`, `menu_items` (parent_id, label_en/bn, href, sort_order), `quick_links`,
   `footer_links` — all with `_en`/`_bn` columns and `is_published` / `published_at`.
8. `routine` (section, day, period, subject, teacher, start/end time).
9. `attendance` (student, date, status, marked_by; unique student+date).
10. Exams: `exams` (is_published), `exam_subjects` (full/pass marks, locked), `marks`.
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
9. **Reference site:** www.cpghs.edu.bd is blocked by this environment's network policy;
   website modules above are a typical set and should be checked against it.
