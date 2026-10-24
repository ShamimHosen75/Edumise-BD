# Build progress

| Step | Status | Notes |
|---|---|---|
| 1.1 Project setup | ✅ Done | See below |
| 1.2 Schema + seed | ✅ Done | See below |
| 1.3 RLS policies | ✅ Done | See below |
| 1.4 Authentication | Not started | Blocked on 1.3 |
| 1.5 i18n + theme | Not started | Blocked on 1.2 |
| 2.1 Site shell + home | Not started | Blocked on 1.5 |
| 2.2 CMS pages + menu | Not started | Blocked on 2.1 |
| 2.3 Content modules | Not started | Blocked on 2.2 |
| 2.4 People + contact | Not started | Blocked on 2.3 |
| 3.1 Academic structure | Not started | Blocked on 2.4 |
| 3.2 Staff management | Not started | Title only; body still needed |
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
