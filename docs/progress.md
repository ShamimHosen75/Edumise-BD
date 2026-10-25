# Build progress

| Step | Status | Notes |
|---|---|---|
| 1.1 Project setup | ✅ Done | See below |
| 1.2 Schema + seed | ✅ Done | See below |
| 1.3 RLS policies | ✅ Done | See below |
| 1.4 Authentication | ✅ Done | See below |
| 1.5 i18n + theme | ✅ Done | Settings page finished with 1.4 |
| 2.1 Site shell + home | ✅ Done | See below |
| 2.2 CMS pages + menu | ✅ Done | See below |
| 2.3 Content modules | ✅ Done | See below |
| 2.4 People + contact | ✅ Done | See below |
| 3.1 Academic structure | ✅ Done | See below |
| 3.2 Staff management | ✅ Done | Scope agreed 2026-10-25; see below |
| 3.3 Online admission | Not started | Blocked on 3.2 |
| 3.4 Student management | Not started | Blocked on 3.3 |
| 3.5 Routine | Not started | Blocked on 3.4 |
| 4.1 Student attendance | Not started | Blocked on 3.5 |
| 4.2 Exams + marks | Not started | Blocked on 4.1 |
| 4.3 Grading + results | Not started | Blocked on 4.2 |
| 4.4 Certificates | Not started | Blocked on 4.3 |
| 5.1 Fee setup + invoices | Not started | Blocked on 4.4 |
| 5.2 Collection + reports | Not started | Blocked on 5.1 |
| 5.3 Payment gateway adapter | Not started | Blocked on 5.2 |
| 6.1 Regression + traceability | Not started | Blocked on 5.3 |
| 6.2 Security audit | Not started | Blocked on 6.1 |
| 6.3 Performance, a11y, SEO | Not started | Blocked on 6.2 |
| 6.4 Deployment + handover | Not started | Blocked on 6.3 |

---

## Step 1.1 — project setup ✅

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 17/17 ·
`db:test` ✅ 2/2 · `build` ✅ · `test:e2e` ✅ 10/10 (desktop Chrome + 360×740) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| `/en` renders a placeholder page | ✅ Pass | e2e `/en renders with no console errors and fits the screen` |
| `/bn` also renders (Definition of done) | ✅ Pass | e2e `/bn renders …` (checks `lang="bn"` and Bangla heading) |
| lint, typecheck, test, build pass | ✅ Pass | commands above |
| One sample unit test and one sample E2E test run | ✅ Pass | `tests/unit/*` (17), `tests/e2e/smoke.spec.ts` (5 × 2 viewports) |
| Local Supabase starts; clients for server, browser, admin | ✅ Pass | `npm run db:start`; `tests/unit/supabase-admin.test.ts` |
| Service-role key never in client code | ✅ Pass | `admin.ts` imports `server-only` (unit test); key string not found in `.next/static` |
| No console errors; fits 360px | ✅ Pass | e2e collects console/page errors and checks horizontal overflow |
| CI workflow | ✅ Pass | GitHub Actions run 1 (checks + e2e) green on commit b9ee122 |

Negative tests: invalid locales rejected (`EN`, `fr`, `bn-BD`, empty, null); admin client
throws without the service key or with an invalid URL; `/fr` returns 404.

Known issues:
- Unknown paths such as `/en/xyz` show Next's default English 404 page. A translated
  404 page will come with Step 1.5 (i18n).
- Pinned versions: Next 15.5 (stack), TypeScript 5.9 (Next 15 does not support TS 7),
  ESLint 9 (eslint-config-next 15 does not support ESLint 10), Playwright 1.63 (matches
  the sandbox browser). PostCSS forced to 8.5.31 via `overrides` to clear two audit
  advisories in the copy bundled with Next 15.
- Local Supabase: edge runtime and analytics are disabled in `supabase/config.toml`
  (not used yet).

---

## Step 1.2 — database schema and seed ✅

Checks (run locally, 2026-10-24): `db:reset` ✅ · `db:test` ✅ 4 files / 45 tests ·
`supabase db lint` ✅ no issues · `db:types` ✅ · `lint` ✅ · `typecheck` ✅ · `test` ✅ 17/17 ·
`build` ✅ · `test:e2e` ✅ 10/10.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| `npm run db:reset` applies all migrations + seed with no errors | ✅ Pass | 12 migrations + 3 seed files apply cleanly |
| Types generate | ✅ Pass | `src/lib/supabase/database.types.ts`; CI fails if it is out of date |
| Typecheck passes | ✅ Pass | `npm run typecheck` |
| Every table has RLS enabled | ✅ Pass | `010_schema` "every public table has row level security enabled" |
| No unexpected tables or views | ✅ Pass | `010_schema` `tables_are` / `views_are` |
| Integrity rules hold | ✅ Pass | `010_schema`: 20 negative tests (one current session, roll unique per section, BD phone, 17-digit birth reg, NID, groups only Class 9–10, marks ≤ full, absent has no marks, teacher clash, money ≥ 0, no double billing, paid ≤ total …) |
| One demo login per role, all can sign in | ✅ Pass | `020_seed`; manual: teacher gets a session, wrong password → `invalid_credentials` |
| Public staff view has no private fields | ✅ Pass | `030_public_staff` (no NID, birth date, address, personal phone) |
| Anon can read nothing yet | ✅ Pass | manual REST check: students, staff, settings, notices, public_staff all return `[]` |

Decisions used (from the open questions): public_staff is a view (Q2); groups only for
Classes 9–10 (Q12); exam status draft → marks_entry → review → published (Q27); fourth
subject on enrollments (Q28); money in bigint poisha (5.1).

Known issues:
- No access rules yet, so the app cannot read any data. That is Step 1.3.
- `public_staff` uses the reader's own permissions; Step 1.3 must grant anon the public
  staff columns, or the public directory will be empty.
- Demo seed is split into `supabase/seed.sql` + `supabase/seeds/*.sql` to keep each file
  under ~300 lines. Generated `database.types.ts` (1,055 lines) is exempt.
- SVG is not allowed in the `public-media` bucket (SVG files can carry scripts). Logos
  must be PNG, JPG or WebP.
- Profile `role` is NULL (no access) unless set by trusted server code via app_metadata.

---

## Step 1.3 — RLS policies ✅

Checks (run locally, 2026-10-24): `db:reset` ✅ · `db:test` ✅ 11 files / 156 tests ·
`supabase db lint` ✅ · `db:types` ✅ · `lint` ✅ · `typecheck` ✅ · `test` ✅ 17/17 ·
`build` ✅ · `test:e2e` ✅ 10/10.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| `npm run db:test` passes | ✅ Pass | 11 pgTAP files, 156 tests |
| No table has RLS disabled (test on `pg_tables.rowsecurity`) | ✅ Pass | `090_rls_coverage` "no public table has row level security disabled" |
| Every table has explicit policies | ✅ Pass | `090_rls_coverage` "every public table has at least one explicit policy" |
| Helpers `auth_role, is_staff, is_admin, teacher_section_ids, guardian_student_ids, my_student_id` (security definer, stable, fixed search_path) | ✅ Pass | `090_rls_coverage`; live in schema `app` (not exposed by the API) |
| Role in profiles + custom access token hook | ✅ Pass | `090_rls_coverage` (hook adds `app_role`, null for unknown/inactive); live login token contains `app_role` |
| Anon reads only published content, public_staff, governing body, routine | ✅ Pass | `100_rls_anon` (20 tests) |
| Teacher: own sections' students, attendance; marks for own subjects; locked marks frozen | ✅ Pass | `120_rls_teacher` (20 tests) |
| Guardian: linked children only. Student: own only | ✅ Pass | `150_rls_guardian` (14), `140_rls_student` (16) |
| Accountant: fees full, students read-only | ✅ Pass | `130_rls_accountant` (14) |
| ≥ 3 negative tests per role | ✅ Pass | anon 11 · super_admin 3 · admin 4 · teacher 11 · accountant 7 · student 8 · guardian 6 |
| Tests really catch broken rules | ✅ Pass | mutation check: adding "everyone reads students" + "everyone updates marks" policies made teacher, student and guardian tests fail |

Design changes:
- `staff_private` (new migration): staff NID, birth date, address, personal phone and
  email moved out of `staff`, because RLS works on whole rows. The public directory reads
  `staff`; private fields need admin or the staff member themselves.
- Profiles are protected by a trigger: users can edit their own name/avatar; only admins
  change role, status, email or phone; only a super_admin touches super_admin accounts.
- RLS reads the role from `profiles` (not the JWT), so a stale token never grants access.
  The JWT `app_role` claim is for middleware routing only.

Decisions used: admins may edit school settings (Step 1.5 says so; the draft matrix said
read-only); anon gets no direct access to marks (Q1: public result lookup returns one
mark sheet through a function in Step 4.3); notice audiences per Q9.

Known issues:
- Teachers cannot create notice drafts yet (Step 2.3 adds that policy).
- The 3-day attendance edit window (Step 4.1) and per-section mark locks (Q29, Step 4.2)
  are not enforced yet.
- `private-docs` storage is admin-only; later steps add narrower rules (e.g. admission
  uploads through the server).

---

## Step 1.5 — i18n and white-label theme 🟡 (built before 1.4, as agreed)

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 79/79 ·
`db:test` ✅ · `build` ✅ · `test:e2e` ✅ 20/20 (desktop Chrome + 360×740).

| Acceptance criterion | Result | Evidence |
|---|---|---|
| `/` redirects by cookie, then Accept-Language, default en | ✅ Pass | unit `pickLocale` (5 cases); e2e "Bangla browser → /bn", "saved cookie wins" |
| Switching language on any page keeps the path | ✅ Pass | unit `switchLocalePath` (6 cases); e2e "switching language keeps the path and is remembered" |
| Dates and numbers show Bangla digits in bn | ✅ Pass | unit `format.test.ts` (21 tests); e2e "প্রতিষ্ঠিত ১৯৭৫" and today's date has no ASCII digits |
| `getDictionary` typed keys, `t()` helper | ✅ Pass | `TranslationKey` type (unknown key = type error, see `@ts-expect-error` test); unit `t` (4 tests) |
| `format.ts`: toBanglaDigits, formatDate, formatCurrency (BDT), pickLocalized with English fallback | ✅ Pass | `tests/unit/format.test.ts` |
| Inter for en, Hind Siliguri for bn (next/font), by lang attribute | ✅ Pass | e2e checks body font family per language |
| Theme colours from school_settings as CSS variables; name from settings | ✅ Pass | e2e: `--primary` = seeded `#0f766e`, page title = school name in each language; unit `buildThemeCss` incl. CSS-injection test |
| Admin `/dashboard/settings` page (Zod server action, logo upload) | ✅ Pass (in 1.4) | e2e `school settings` tests; schema `tests/unit/school-settings-schema.test.ts` |
| Changing the primary colour in settings changes the site colour | ✅ Pass (in 1.4) | e2e "changing the primary colour changes the site colour" (blue appears on `/en`, then restored) |
| Both en and bn render, no console errors | ✅ Pass | e2e smoke tests |

Negative tests: invalid cookie / unknown languages fall back to en; fractional poisha and
invalid dates throw; bad colours fall back to defaults and cannot inject CSS; settings form
rejects bad colours, EIIN, http/javascript URLs, non-Google map embeds, SVG/large logos.

Also fixed: a translated 404 page for unknown paths under `/en` and `/bn` (known issue
from 1.1).

Bug found and fixed during QA: a failed settings read was cached for an hour, so one
database hiccup would leave the site unbranded. Failures are now never cached (unit test
"does not cache a failed read").

Known issues:
- The language switch keeps the path but not query strings (none are used yet).
- "Today is …" on the home page is part of the static page, refreshed hourly.
- CI end-to-end job now starts local Supabase, so pages show real settings.

---

## Step 1.4 — authentication ✅ (plus the 1.5 settings page)

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 123/123 ·
`db:test` ✅ · `build` ✅ · `test:e2e` ✅ 68 passed, 2 skipped by design (phone-only /
desktop-only checks), desktop Chrome + 360×740.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| All 6 seeded users can log in | ✅ Pass | e2e "each seeded role" ×6 (admin logs in by mobile number, others by email) |
| Each lands on its own dashboard and gets 403 on another role's page | ✅ Pass | same tests: own `home-<role>` widgets visible; another role's page → HTTP 403 |
| Wrong password shows an error | ✅ Pass | e2e "a wrong password shows an error…"; unknown phone gets the same message |
| Protected routes are blocked when logged out | ✅ Pass | e2e "protected pages redirect to login…", "after logout the dashboard is blocked again" |
| Login: email or phone + password, errors, loading state | ✅ Pass | e2e validation errors in en and bn; button shows "Logging in…" and is disabled while submitting |
| Forgot / reset password (Supabase email flow) | ✅ Pass | e2e reads the email from local Mailpit, follows the link, sets a new password, logs in with it |
| Forced password change on first login | ✅ Pass | e2e "first login forces a password change" (dashboard stays closed until changed) |
| Middleware protects `/[lang]/dashboard/**` | ✅ Pass | redirect to `/[lang]/login?next=…`, then back to the page after login |
| Sidebar from a typed config filtered by role | ✅ Pass | unit `nav.test.ts` (filter, order, labels, active state); e2e sidebar per role and phone menu |
| Role-specific home page for each of the 6 roles | ✅ Pass | `/dashboard/{super-admin,admin,teacher,accountant,student,guardian}` |
| `requireRole(roles[])` used in layouts and server actions | ✅ Pass | unit `session.test.ts` (6 tests); used by role pages, settings page and settings action |
| Logout | ✅ Pass | e2e logs out and checks the dashboard is closed again |
| Both languages, 360px, no console errors | ✅ Pass | dashboard in Bangla e2e; 360px overflow checks for login and dashboard |

Negative tests added: wrong password, unknown phone, malformed identifier, crafted
`?next=https://evil…`, invalid reset link, teacher opening settings (403), a login with no
role, an SVG renamed to `.png` uploaded as a logo (rejected by its real content), weak and
mismatched new passwords, unknown email on the forgot page (same answer as a real one).

Bugs found and fixed during QA:
1. **Whole site was rendered on every request** (since 1.5): the 404 page read a request
   header, which made every page under `/[lang]` dynamic. Fixed; `/en` and `/bn` are
   prerendered again.
2. **Saving settings made `/en` and `/bn` return 404** until the next deploy
   (`dynamicParams = false` + full-site revalidation in Next 15). Fixed by revalidating only
   pages tagged with the settings, and dropping `dynamicParams = false`.
3. **Saving settings turned the theme colours black**: colour inputs started as `#000000`
   before the form library filled them. Fixed by rendering saved values into the HTML;
   regression check in the logo upload e2e (verified it fails without the fix).
4. **Redirect loop** for a login without a usable profile (no role, or deactivated after
   the token was issued). Fixed: such users see "Your account has no access".
5. Local config: `[auth.email] enable_signup = false` disabled email login entirely. Public
   sign-ups are blocked by `[auth] enable_signup = false` instead (verified: sign-up API
   returns `signup_disabled`).

Decisions used: phone login looks up the profile's email on the server (Q3, no SMS
provider); public sign-up disabled; passwords at least 8 characters with letters and
digits; the JWT `app_role` claim is used only for routing, access is checked against the
profile on every request.

Known issues:
- Login rate limiting: Supabase limits sign-ins per IP, but logins go through our server,
  so in production every user shares the server's IP. Needs an app-level limit (Step 6.2).
- Accounts created through the Supabase admin API get their role after the new-user
  trigger runs, so account-creation code (admissions 3.3, staff 3.2) must set
  `profiles.role` itself, as the test helper does.
- The reset link must be opened in the same browser that requested it (Supabase PKCE).
- Local auth rate limits are raised in `supabase/config.toml` for tests; production
  limits are configured in the Supabase dashboard (Step 6.4).
- E2E runs with one worker (some tests change shared settings), about 2 minutes.

---

## Phase 1 code review ✅

Full report: [`docs/code-review-phase-1.md`](code-review-phase-1.md). 6 security and 3
correctness findings fixed with regression tests (forced password change could be
skipped; password change without current password; no app-level login limit and a
shared-IP lockout risk; reset-email flooding; reset link built from Origin; anon could read
`staff.profile_id`; light main colours failing AA; local logo not loading; test left data
behind). Performance, maintainability and UX items are recorded for later steps.

Production note for Step 6.4: raise Supabase's own sign-in rate limit, since the app now
limits logins itself and Supabase sees every login from the server's IP.

---

## Step 2.1 — public site shell and home page ✅ (WEB-01, WEB-02, WEB-16)

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 173 · `db:test` ✅
13 files / 185 tests · `db lint` ✅ · `build` ✅ (`/en`, `/bn` prerendered, ISR) ·
`test:e2e` ✅ 94 passed, 4 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| Top bar: phone, email, social (hidden if empty), language switch, Apply Online, Login | ✅ Pass | home e2e; Apply Online hidden until Step 3.3 adds the page (route registry) |
| Header with logo + name; responsive mega-menu from `menu_items` (desktop drop-downs, mobile sheet) | ✅ Pass | e2e desktop drop-down (opens, Escape closes and returns focus, leads to page); e2e phone sheet in Bangla |
| 10 menus: Home, About, Information, Academic, Admission, Student, Facilities, Result, Others, Contact | ✅ Pass | seeded; menus whose items have no page yet are hidden (unit `buildMenu`, e2e "menu items … are hidden") |
| Footer: address, contact, configurable govt/education links, social, copyright | ✅ Pass | `site_links` (footer); copyright year in Bangla digits (e2e) |
| Home sections, each its own server component, hidden when empty | ✅ Pass | 10 components in `src/components/site/home/`; unit `home-sections.test.tsx` (11 empty cases) |
| Hero carousel, notice ticker + latest 5 notices, institute facts, quick links, head teacher's message, teacher highlights, live counters, class-wise bar chart, upcoming events, gallery preview | ✅ Pass | e2e "all sections render" in en and bn; counters 20 / ২০ from `public_stats()` |
| ISR with revalidateTag | ✅ Pass | `/en`, `/bn` prerendered (revalidate 1 h); data cached with tags (`src/lib/site/cache.ts`); settings save revalidates (e2e colour test). Other tags are used by the editors in 2.2/2.3 |
| Primary colour from settings; works at 360px | ✅ Pass | screenshots; e2e overflow checks |
| E2E: home loads in en and bn; no broken header/footer links (crawl, assert 200) | ✅ Pass | `home.spec.ts` crawls top bar, header (incl. opened menus / phone sheet) and footer links in both languages; external links must be https with `rel="noopener noreferrer"` |

Negative tests: unpublished page → 404; hidden/unpublished menu items and links not shown;
menu depth > 2, `javascript:`/`http:` links and page+URL together rejected by the
database; visitors cannot edit menu/links; `public_stats()` returns counts only and
students stay unreadable; home page HTML contains no staff NID, birth date, address or
personal phone.

Decisions:
- **Route registry** (`src/lib/routes.ts`): links to pages from later steps are hidden until
  that step adds its route, so the site never shows a broken link.
- **Read-only `/p/[slug]` pulled forward from Step 2.2** so the menus have pages to open.
  It shows the body as plain text (tags stripped, never rendered). Step 2.2 adds rich text,
  cover image, attachments, the editor and the full page list.
- **Demo photos** ship with the app in `public/demo/` (generated by
  `scripts/generate-demo-images.mjs`); real schools upload to Storage.
- **Live counters** use `public_stats()`, a security-definer function that returns totals
  only (open question 6).
- Event times use a 24-hour clock in both languages (Bangla otherwise shows "AM"/"PM" in
  English letters).

Known issues:
- Notice titles, events and teacher cards are not links yet; they link automatically once
  Steps 2.3 / 2.4 add those pages to the route registry.
- The demo school has students only in Classes 6 and 9, so the chart shows zeros for 7, 8
  and 10 (kept, so the RLS tests' fixed data stays valid).
- Local Supabase images skip Next's image optimizer (it refuses 127.0.0.1); production
  images are optimized.
- 404 / 403 pages still have no site header and footer.

---

## Step 2.2 — CMS pages and menu ✅ (WEB-03, WEB-04)

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 199 · `db:test` ✅
14 files / 196 tests · `db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅ 107
passed, 5 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| `/[lang]/p/[slug]`: title, rich content, cover image, attachments | ✅ Pass | e2e (Bangla edit published and shown; PDF attachment listed on the public page) |
| Seed pages for every static menu item (33 slugs) | ✅ Pass | `supabase/seeds/04_site.sql`; grouped under About, Information, Academic, Admission, Facilities |
| Dashboard Pages list with search and draft/published status | ✅ Pass | `/dashboard/pages` (search by title or address, status filter, "Empty" badge); e2e finds a page by search |
| Editor with EN/BN tabs, Tiptap rich text, sanitised HTML, image upload, SEO title/description | ✅ Pass | `page-editor.tsx`, `rich-text-editor.tsx`; HTML sanitised on save and again on render |
| Menu builder: add, rename EN/BN, reorder (up/down), link to page or URL, hide | ✅ Pass | `/dashboard/menu`; e2e adds an item, sees it in the header, moves items, deletes |
| Items pointing to empty/unpublished pages hidden automatically | ✅ Pass | `pages.has_content` (generated); unit `buildMenu`; e2e: `donors` (empty) and `history` (draft) not in header, 404 |
| Test: HTML sanitiser strips script / onerror | ✅ Pass | unit `cms.test.ts` (9 sanitiser tests) |
| E2E: admin edits a page in bn, publishes, public page shows new text | ✅ Pass | `cms.spec.ts` |

Negative tests: stored `<script>`, `onerror` and `javascript:` links do not run on the
public page (e2e checks `window` was not touched); a fake PDF (HTML renamed .pdf) is
refused by content; attachment paths outside `attachments/` and non-PDF/image types are
rejected by the database; visitors cannot read attachments of drafts or change them;
teachers get 403 on the page editor and menu builder and cannot edit pages via the API;
unsafe menu URLs (`javascript:`, `http:`, missing slash) are rejected.

Decisions:
- Kept the editor's HTML allow-list small (headings, paragraphs, lists, quotes, tables,
  links, images from our own storage). Images from other sites are removed so pages cannot
  track visitors.
- Dropped `@tailwindcss/typography` (its parser had a moderate advisory); page text uses a
  short `.rich-text` style in `globals.css`.
- In Bangla, the editor's heading buttons are "বড় শিরোনাম" / "ছোট শিরোনাম" so they are not
  confused with the "শিরোনাম" (Title) field.
- Pages list uses a plain server-rendered table; the shared TanStack DataTable comes in
  Step 3.1 as specified there.

Known issues:
- Reorder is by up/down buttons (the spec allows "drag or up/down"); drag-and-drop not built.
- Menu items cannot be moved between menus (delete and re-add instead).
- Deleting a page does not delete its uploaded images from storage (attachments are deleted).
- The link dialog in the editor uses the browser's prompt box.

## Step 2.3 — content modules ✅ (WEB-07, WEB-08, WEB-14, NOT-01)

Checks (run locally, 2026-10-24): `lint` ✅ · `typecheck` ✅ · `test` ✅ 233 · `db:test` ✅
15 files / 220 tests · `db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅
137 passed, 5 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| Public list page per module with search, filters and pagination | ✅ Pass | `/notices` (search + category), `/news` (search), `/events` (upcoming/past), `/gallery`, `/downloads` (search + category); 10 per page; e2e pagination, category filter, search |
| Public detail page per module | ✅ Pass | `/notices/[slug]`, `/news/[slug]`, `/events/[slug]`, `/gallery/[slug]`, `/downloads/[id]`; e2e `content-pages.spec.ts` (en + bn, 200, no console errors, no sideways scroll at 360 px) |
| Dashboard CRUD with EN/BN fields, draft/publish, publish date, file upload | ✅ Pass | `/dashboard/{notices,news,events,gallery,downloads}`: list (search, status draft/scheduled/published), create, edit, delete, file upload; e2e creates notices, a download and an album |
| Notices: category, audience (public/staff/class), pin, PDF/image attachment with inline PDF preview and download, share buttons | ✅ Pass | notice form + `FileAttachment` (`<object>` PDF preview, download link) + `ShareButtons` (Facebook, WhatsApp, X, copy link); e2e "notice page previews the PDF…" |
| Teachers create notice drafts; admin publishes | ✅ Pass | RLS policies (migration 2200) + server forces draft; pgTAP `220_content_modules` (12 teacher checks); e2e "a teacher writes a notice draft and an admin publishes it" |
| News: cover image, body | ✅ Pass | cover upload on the edit page; cards with cover and excerpt |
| Events: date/time, venue, photos; upcoming vs past tabs | ✅ Pass | start/end in Bangladesh time, venue EN/BN, photos from a linked album; e2e "events are split into upcoming and past" |
| Gallery: albums with cover, bulk photo upload resized to max 1600 px WebP in the browser, lightbox with keyboard and captions | ✅ Pass | `album-photos.tsx` + `resize-image.ts`; captions EN/BN, set cover, remove; e2e bulk upload of 2 photos and lightbox arrow keys / Escape / focus return |
| Downloads: category, file, size and type shown | ✅ Pass | e2e "downloads show category, size and type…" |
| Open Graph metadata on every detail page; `sitemap.ts` and `robots.ts` | ✅ Pass | `detailMetadata()` (title, description, image, canonical, hreflang, Twitter card); unit + e2e "sitemap and robots are served" (drafts not listed) |
| Unit test for slug/date helpers | ✅ Pass | `content.test.ts`, `content-admin.test.ts` (Dhaka time round trip, schedule, status, sitemap, OG) |
| RLS test: drafts invisible to anon | ✅ Pass | pgTAP `220_content_modules` (draft notices, news, events, albums, downloads and scheduled notices hidden) |
| E2E: draft not visible → publish → visible on home ticker and list | ✅ Pass | `content.spec.ts` first test |

Negative tests: a teacher cannot publish (insert or update), write in someone else's name,
see or edit others' drafts, edit or delete published notices, write news, or upload outside
`notices/<own id>/`; a published download without a file is refused by the database and
the form says "Upload the file before publishing."; downloads accept only the fixed
categories; a student gets 403 on content editors; unknown items, ids and modules are 404;
the event form rejects an end before the start and a bad address; uploads are checked by
their real content (PDF/PNG/JPG/WebP) and size.

Decisions:
- Event photos come from a linked gallery album (`events.album_id`) instead of a second
  photo table, so photos are uploaded and captioned in one place.
- `downloads.file_path` is now optional so a download can be saved before its file is
  uploaded; a database check keeps published downloads from having no file.
- One generic dashboard (`/dashboard/[module]`) serves all five modules; the module list,
  roles and file column live in `src/lib/content/modules.ts`.
- Uploads are limited to 4 MB for attachments/downloads and 2 MB for images: Vercel
  accepts request bodies up to 4.5 MB. Server actions now accept 5 MB bodies (was 2 MB).
  The browser checks the size first and shows "The file is too large." This also fixes the
  Step 2.2 page attachments, which said 10 MB but could not take more than 2 MB.
- The home page "Latest notices", "Upcoming events" and "Gallery" sections now link to
  their full lists, and event titles link to the event page.
- A shared error page (`[lang]/error.tsx`, "Try again") replaces the framework's default
  when a page fails to load.

Known issues:
- Scheduled items appear up to an hour after their publish time (pages are cached for an
  hour; saving in the dashboard refreshes them at once).
- Staff and class notices are stored but shown nowhere yet; the portal notice board comes
  with the student/teacher portal steps.
- The PDF preview depends on the browser's PDF viewer; where it has none (some phones) the
  page shows "Open the PDF" and the download link instead.
- Photos are uploaded one at a time (with progress); there is no drag-to-reorder.
- Teachers cannot delete files they uploaded to a draft (Storage has no delete policy for
  them); replaced files stay in Storage until an admin cleans up.
- Detail pages do not repeat the school name in `og:site_name`.

## Step 2.4 — people and contact pages ✅ (WEB-05, WEB-06, WEB-15)

Checks (run locally, 2026-10-25): `lint` ✅ · `typecheck` ✅ · `test` ✅ 246 · `db:test` ✅
16 files / 238 tests · `db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅
155 passed, 5 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| Teachers and staff directory, current and former, grouped and ordered by designation rank | ✅ Pass | `/teachers` (Current / Former tabs); unit `groupByDesignation`; e2e "the directory groups by designation…" |
| Cards with photo, name, designation, subject | ✅ Pass | shared `PersonCard` (initials when there is no photo), also used on the home page, which now links to profiles |
| Profile page shows ONLY public fields (photo, name, designation, subjects, qualification, joining year, short bio) | ✅ Pass | `/teachers/[id]` reads the `public_staff` view (no private columns: pgTAP `hasnt_column` × 4) |
| Governing body and ex-governing body grouped by term; ex-principals list | ✅ Pass | `/governing-body` (Current / Former, one heading per term), `/ex-principals`; unit `groupByTerm` |
| Dashboard CRUD for governing body and ex-principals | ✅ Pass | `/dashboard/governing-body`, `/dashboard/ex-principals` (add, edit, delete, photo); e2e adds a member and sees it on the public page |
| Contact form (name, phone, email, subject, message) with Zod validation | ✅ Pass | `contactSchema` on client and server; Bangla digits and +880 numbers accepted |
| Honeypot + rate limit (5/hour per IP), saves to `contact_messages` | ✅ Pass | e2e "allows 5 messages an hour… and ignores bots" (6th refused, bot message not stored) |
| Google Maps embed from settings; office hours | ✅ Pass | `/contact` (only Google Maps embed links are shown) |
| Admin inbox to read and mark messages | ✅ Pass | `/dashboard/messages` (All / Unread, unread count, opening marks read, mark unread, delete) |
| E2E: staff profile HTML has no seeded NID, birth date or address | ✅ Pass | `people.spec.ts` (en and bn) |
| E2E: contact validation errors in both languages | ✅ Pass | `people.spec.ts` |

Negative tests: visitors and teachers cannot read, write or mark contact messages, or
change former head teachers; teachers get 403 on the inbox and the people editors; the
database refuses messages without a valid mobile number or over 2000 characters, and a
head teacher who left before joining; the forms reject a term that ends before it starts,
years in the future and bad dates; unknown profile ids are 404.

Decisions:
- One directory page (`/teachers`) for teaching and office staff: the "Staff" designation
  is its last group. Former staff are a tab, not a separate page.
- "Current" governing body = terms with no end date or ending today or later (Bangladesh
  date); everything else is shown under Former.
- Contact messages are written by the server with the service role after validation, the
  honeypot and the rate limit; there is no insert policy for anyone. The phone number is
  required (the office calls back); email is optional.
- Rate limit counts accepted messages only, so typing mistakes do not use up the limit.
- The rich text editor field moved to its own file so simple dashboard forms do not load
  the editor (governing body form: 299 kB → 163 kB).

Known issues:
- Staff photos and bios are edited in Step 3.2 (staff management); the seed has no photos,
  so cards show initials.
- No email notification for new contact messages (not in the spec); admins see them in
  the inbox.
- Governing body members are ordered by "Order in the list" within a term; there is no
  drag-to-reorder.

## Phase 2 code review ✅

Full report: [`docs/code-review-phase-2.md`](code-review-phase-2.md). Checks after the
fixes: `lint` ✅ · `typecheck` ✅ · `test` ✅ 265 · `db:test` ✅ 17 files / 246 tests ·
`db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅ 159 passed, 5 skipped by
design · `npm audit` 0.

Fixed (each with a regression test where it can be tested):
- Security: visitors could list every file in the public storage bucket (finding draft and
  staff-only attachments by name); a teacher could point a draft at any file and get it
  deleted by an admin's clean-up; ids sent to server actions were not validated; the
  pages list crashed on a repeated search parameter.
- Correctness: list pages past the end showed the error page (now go to the last page);
  a database blip could cache a 404 for an existing item; scheduled items now appear
  within 5 minutes (was up to an hour; supersedes the Step 2.3 known issue); wrong
  hreflang on list pages; English SEO title on Bangla pages; home and events page
  disagreed on running events; HTML entities in excerpts; "Link copied" shown when
  nothing was copied; clearing a scheduled date did not publish now; unpublishing a page
  lost its first publish date; a teacher's save erased an admin's date; unhandled save
  errors; files left in storage after replace/remove/delete.
- Also: five missing indexes, `sizes` on large images, translated attachment details,
  arrows hidden from screen readers, keyboard-scrollable dashboard table.

Recorded for later: shared action helpers (Step 3.1), tabs as path segments and editor
lazy-loading (Step 6.3), slide link column (ask the owner). Production note for Step 6.4:
the contact form's per-IP limit relies on Vercel setting `X-Forwarded-For`.

## Step 3.1 — academic structure management ✅

Checks (run locally, 2026-10-25): `lint` ✅ · `typecheck` ✅ · `test` ✅ 278 · `db:test` ✅
18 files / 254 tests · `db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅
167 passed, 5 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion | Result | Evidence |
|---|---|---|
| Dashboard pages: Sessions (set one as current), Classes, Sections (capacity, class teacher), Groups, Subjects (code, EN/BN name, type), Class-Subjects per class and group | ✅ Pass | `/dashboard/academic/{sessions,classes,sections,groups,subjects,class-subjects}` with tabs; "Make current" uses `set_current_session()` (one statement, never two current sessions) |
| Reusable DataTable (TanStack): search, column filters, sort, pagination, CSV export, row actions, empty and loading states | ✅ Pass | `src/components/ui/data-table.tsx` (+ `data-table-skeleton.tsx`, `loading.tsx`); CSV via `src/lib/csv.ts` (BOM for Bangla, formulas defused); e2e search/filter/sort in Bangla and CSV download |
| Reusable FormDialog: react-hook-form + Zod + server action + toast | ✅ Pass | `src/components/ui/form-dialog.tsx`, Sonner `Toaster` in the dashboard layout; used for add/edit on every academic page |
| Unit tests for Zod schemas | ✅ Pass | `tests/unit/academic.test.ts` (13) |
| E2E: create session → class → section → map subjects | ✅ Pass (see note) | `tests/e2e/academic.spec.ts` |

Note on "create class": the school has Classes 6 to 10 and a class level is unique (6–10),
so the e2e test checks that adding a class validates the level and refuses a duplicate,
then edits Class 9. Creating a class works for a new school with no classes yet.

Negative tests: a teacher gets 403 on the academic pages and cannot change the current
session in the database; the current session and a subject still in use cannot be
deleted ("still in use"); bad dates, an end before the start, levels outside 6–10, bad
group/subject codes, capacity out of range, repeated subjects and a missing group for
Classes 9–10 are refused; section names are unique per class whatever their case.

Decisions:
- One "Academic setup" item in the sidebar with tabs for the six pages.
- Shared server-action helpers (`src/lib/actions.ts`: `requireAdmin`, `invalid`, `dbError`)
  as recorded in the Phase 2 review; older action files move to them when next changed.
- The role check also runs in the academic layout, because a page with a loading
  skeleton starts streaming before the page itself can answer 403.
- Lists are filtered and sorted in the browser: a school's sessions, classes, sections,
  groups and subjects are a few dozen rows.

Known issues:
- Deleting a section that has a routine or attendance (but no students) also deletes those
  (database cascade from Step 1.2); sections with students cannot be deleted.
- Class subject choices are saved per class and group; copying a group's subjects to
  another class is not built.

## Step 3.2 — staff management ✅ (scope agreed after Step 3.1)

Checks (run locally, 2026-10-25): `lint` ✅ · `typecheck` ✅ · `test` ✅ 289 · `db:test` ✅
19 files / 263 tests · `db lint` ✅ · types up to date ✅ · `build` ✅ · `test:e2e` ✅
177 passed, 5 skipped by design (desktop-only / phone-only checks) · `npm audit` 0.

| Acceptance criterion (agreed scope) | Result | Evidence |
|---|---|---|
| Staff list with designation, subject, current/former and login status; filters, search, CSV | ✅ Pass | `/dashboard/staff` (DataTable); e2e filter "Former" in Bangla |
| Designations managed (rank, EN/BN name, teaching post) | ✅ Pass | `/dashboard/staff/designations` (reuses the academic table and dialog); e2e duplicate rank refused |
| Profile with public and private fields; private never on public pages | ✅ Pass | `/dashboard/staff/[id]`; e2e checks the public profile HTML has no NID, birth date, address or mobile; pgTAP: teachers see only their own private record |
| Former staff via leaving date | ✅ Pass | `left_on`; public directory "Former" tab (Step 2.4) |
| Teaching assignments per section, subject and session | ✅ Pass | e2e: add, refuse a subject another teacher teaches, subjects limited to the class, remove |
| Staff logins with one-time password, forced change, switch off/on, new password | ✅ Pass | e2e: create → password shown once → teacher must change it → switched off → "no access" |

Negative tests: bad NID, mobile, email, future birth date and leaving before joining are
refused; an email already used by another login is refused; admins are not offered the
admin role (only a super admin can give it) and cannot switch off a super admin; teachers
get 403 on staff pages and cannot add or edit staff, assign subjects or raise their role.

Decisions:
- One-time passwords shown to the admin (copy button) instead of invitation emails: works
  without an email service and suits a school office. The person must choose their own
  password at first sign-in (existing Step 1.4 flow).
- Deleting a member of staff switches their login off (it is not deleted), so records that
  name the account stay readable.
- Supabase saves a new login's app metadata after the profile trigger runs, so the role,
  names and mobile are written to the profile by the server right after creating it.
- Fixed while testing: email fields failed on leading/trailing spaces (contact form, school
  settings, staff); two forms on one page shared field ids (fields can now take an id).

Known issues:
- Staff cannot yet view or edit their own profile from their dashboard (a later portal step).
- No bulk import of staff from a spreadsheet.

