# Phase 6 code review

**Scope:** `git diff c2dc848..4743dcc`, covering Steps 6.1–6.4:
- full regression, traceability and the day-in-the-life scenarios;
- the security audit and its fixes;
- performance, accessibility, SEO, mobile and print checks;
- the production deployment kit.

That is 76 files and about 14,300 lines (screenshots aside). Reviewed 2026-11-01 as a strict senior reviewer, in four parts:
- security;
- correctness;
- test quality, CI and maintainability;
- UX, i18n, accessibility, performance and documentation accuracy.

**How findings were checked:** against the code, and the database ones against the local Supabase as the seeded users, in transactions that were rolled back.

**Fixes:** security and correctness items were fixed in this change, with regression tests:
- pgTAP: `410_phase6_review` and two cases added to `400_security_audit`;
- unit: `security-audit.test.ts`;
- browser: `privacy-crawl`, `security-headers`, `accessibility` were tightened (see Tests).

Database fixes are in a new migration, `20261104004100_phase6_review_fixes.sql`. Applied migrations were not edited.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | **Medium.** An admin could make anyone an admin, and switch the super admin or another admin off, straight through the API. The app allows only a super admin to manage admin accounts; the Step 6.2 profile guard only protected super admins. Verified as the demo admin. | `app.protect_profile` | The guard enforces the app's rule: only a super admin gives or takes the admin role, or changes another admin's status, contact details or password flag. Admins still edit teachers, accountants, families and their own details. | ✅ Fixed | pgTAP 410 (seven checks) |
| S2 | **Medium.** `x-vercel-forwarded-for` was trusted everywhere. Off Vercel (self-hosted, Docker, nginx) a client could send it and choose its own "address", defeating every per-IP limit: login, result search, certificate checks, contact, admissions, and the per-account-and-address login lock. | `rate-limit-keys.ts` | The header counts only when the app runs on Vercel (`VERCEL` is set); elsewhere `TRUSTED_PROXY_HOPS` decides, as documented. | ✅ Fixed | unit "off Vercel, that header is ignored" |
| S3 | **Medium.** The service-role key doubled as the bearer token of `/api/revalidate`, and the deploy guide told the school to paste it into a Supabase webhook header, where it is stored in the database and written to HTTP logs. A key that bypasses every access rule must never travel as a plain shared secret. The byte-length check could also throw on a non-ASCII token (500 instead of 401). | `api/revalidate/route.ts`, `docs/deploy.md` | A separate `REVALIDATE_SECRET`; both sides are hashed before the constant-time compare. CI and the test suite set their own throwaway value. | ✅ Fixed | `smoke-prod` (401 without it), `home.spec` (200 with it) |
| S4 | **Low.** Deleting a staff member switched the profile off but did not block the login in Auth, so an existing session token kept working until it expired; and a switched-off account got a different sign-in message from a wrong password, telling which logins exist. | `staff/actions.ts`, `(auth)/actions.ts` | The delete path blocks the login too. A switched-off account gets the same answer as a wrong password (an account without a role still gets the "no access" message: that is a setup problem, not a secret). | ✅ Fixed | e2e `staff.spec` |
| S5 | **Low.** The hourly cap of 100 failures per account could be filled from many addresses to keep the real owner locked out, again every hour, because success never cleared the counters. | `(auth)/actions.ts` | A correct password clears both of the account's failure counters (new `clear_rate_limit`, service role only). | ✅ Fixed | pgTAP 410 |
| S6 | **Info.** CSP keeps `script-src 'unsafe-inline'` (Next.js without per-request nonces); the sanitizer is the barrier against XSS. Documented in the security report. | `next.config.ts` | — | Accepted | `security-headers` now asserts every directive |
| S7 | **Info.** The demo seed's shared password is fine locally and in CI; an internet-facing demo site ships known logins. | `supabase/seed.sql` | Noted in `docs/rebrand.md` (demo seed never on a school's project). | Accepted | — |

**Checked and fine:**
- Every security-definer function in `public` and `app` has an empty `search_path` (catalogue check in pgTAP 400).
- The Step 6.2 helpers require an active profile with the matching role; the teacher policies are strictly narrower than before; TRUNCATE, REFERENCES and TRIGGER are revoked from the API roles.
- The rate-limit and audit functions run with the service role only, so counters cannot be poisoned from a browser.
- Sign-in: the same message and a real password check for unknown accounts; Supabase's own rate limit handled; the next-path is validated.
- Health route: no configuration or error details; no caching. Revalidate: tags from the known list only.
- Sanitizer: `..` in plain, mixed and encoded forms is refused; `javascript:` dropped; external links get `rel="noopener noreferrer"`.
- Uploads: magic-byte type detection, size limits, UUID paths under per-record folders, deletions limited to those folders.
- The favicon path from settings cannot inject markup (each segment is percent-encoded); theme colours are validated.
- `create-admin.mjs` needs the service key from the environment, prints the one-time password once, and removes the Auth user if the profile update fails.
- The production seed has no users, no policies and no secrets. The guide screenshots show only the fictional demo school.

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | **Medium.** The bundle secret check looked for `service_role` inside a JWT at one base64 alignment of three. Whether a real project's key matched depended on the length of its project reference; the local key did not match at all. In the CI job that runs the check there is no `.env.local`, so this marker was the only value-based check. | `scripts/check-bundle-secrets.mjs` | All three encodings are needles. | ✅ Fixed | — (script; checked against the local key) |
| C2 | **Low.** Switching a login on or off updated the profile and then Auth; if the Auth call failed, the two disagreed (switched on in the database, still blocked in Auth: "wrong password" for ever). | staff and student `login-actions.ts` | On an Auth failure the profile change is reverted and the error shown. | ✅ Fixed | — |
| C3 | **Low.** On a Vercel preview that shares the live site's address variable, the test gateway was refused even with its secret set, so online payment could not be tried before going live. | `payments/sandbox.ts` | Preview and development deployments on Vercel allow it. | ✅ Fixed | unit |
| C4 | **Low.** The Step 6.2 migration dropped a Phase 4 policy by a name over 63 characters; it only matched because both names truncate the same way. | `20261103004000` | Nothing to change (applied migrations are not edited); noted here so a later rename does not break the chain. | Accepted | — |
| C5 | **Info.** The Step 6.2 D2 policies changed what a teacher sees: not the attendance or results of a student who moved out of their section mid-session, and no results of a previous session's exam. Admins see everything. | `20261103004000` | Documented in `docs/security-report.md`. | Accepted | pgTAP 400 |

**Checked and fine:**
- Sign-in resolves phone, student ID and email to one account, so every way of typing it shares the counters; `is_rate_limited` (`>=`) and `hit_rate_limit` (`>`) agree.
- `ban_duration: "none"` is Supabase's unban; `876000h` parses.
- The production seed runs on an empty schema without a constraint error; the late-fine head from the migration is untouched; every menu item resolves to a page. It is meant to run once (the menu rows have no conflict clause).
- Dictionaries: identical key sets, no empty strings; the removed `attendance.studentStatus` has no callers.
- Marks: Bangla digits shown in `bn` still parse (`toAsciiDigits` first); the dirty check compares numbers.
- The new accessible names keep the visible text (header, attendance buttons, routine cells).
- Lighthouse CI finds the build because Playwright's server builds first; the port does not collide.

## Performance

Nothing new. Headers are static strings; no client JavaScript was added to the public site; every cache tag has a writer or is covered by `/api/revalidate`. The Lighthouse report is now kept as a CI artifact instead of being uploaded to public temporary storage.

## Maintainability and tests

| # | Finding | Where | Fix | Status |
|---|---|---|---|---|
| T1 | **Major.** The privacy crawl could miss a leak: it did not collect staff and guardian emails, login phones, or anything from admission applications; no seeded student had a personal phone, so a leak of that column was undetectable; dates in the "short" style were not checked; values were matched against raw HTML, so an escaped address would pass; one total count let a whole table be empty. | `privacy-crawl.spec.ts`, seed | All those columns are collected; one seeded student has a personal phone; a temporary application is made for the crawl and removed after it; all three date styles; the page text is entity-decoded; each kind of record must contribute. | ✅ Fixed |
| T2 | **Major.** The crawl never reached a mark sheet (`/result?…`, built by the form) or a certificate (`/verify/<ref>`), the pages that print a named person. | `privacy-crawl.spec.ts` | Both are seeded into the crawl from the database and asserted as visited. | ✅ Fixed |
| T3 | **Major.** The axe test could pass on a 404 (a missing page has little to find) and used hard-coded ids. | `accessibility.spec.ts` | Every page must answer below 400; ids come from the database through the shared `withIds` helper. | ✅ Fixed |
| T4 | **Major.** The headers test checked that a CSP existed, not what it said; HSTS was not checked. | `security-headers.spec.ts` | Every directive's exact value and the HSTS header are asserted. | ✅ Fixed |
| T5 | **Minor.** The attendance scenario skipped itself on a weekend or holiday. | `day-admission-school.spec.ts` | It marks the latest school day in the three-day edit window. | ✅ Fixed |
| T6 | **Minor.** The switched-off teacher case was missing from pgTAP 400. | `400_security_audit` | Added. | ✅ Fixed |
| T7 | **Minor.** Helpers copied between the day scenarios (`toast`, `fill`, `pick`, `uid`); two scenario files over 300 lines; the crawl and axe tests are single long tests. | `tests/e2e/day-*.spec.ts` | Left as is: test code, read top to bottom. | Accepted |
| T8 | **Minor.** The bundle check runs in the `checks` job, where no `.env.local` exists, so only the static needles apply there. | `ci.yml` | Acceptable now that the needles cover every key encoding. | Accepted |

## UX and i18n

| # | Finding | Where | Fix | Status |
|---|---|---|---|---|
| U1 | **Minor.** Hind Siliguri no longer loads weight 500, so every `font-medium` (form labels, the dashboard menu) fell back to regular in Bangla only. | `layout.tsx` | In Bangla, medium text uses the semibold file (one CSS rule, no extra font file). | ✅ Fixed |
| U2 | **Minor.** The Bangla user guide named screens and buttons with words that are not on screen (for example "বিদ্যালয়ের সেটিংস" for "স্কুল সেটিংস", "উপস্থিতি" for "হাজিরা"); the English guide was approximate in three places. | `docs/user-guide-*.md` | Labels copied from the dictionaries. | ✅ Fixed |
| U3 | **Minor.** `docs/rebrand.md` pointed to a grading form that does not exist (the scale is a database column). `PAYMENT_SANDBOX_ALLOW_LIVE` was missing from `.env.example` and the deploy guide; the Node version differed from `package.json`. | docs | Corrected. | ✅ Fixed |
| U4 | **Minor.** The home gallery gave each photo the caption as alt text too, so screen readers heard it twice (Lighthouse `image-redundant-alt`). | `gallery-preview.tsx` | Empty alt; the caption names the photo. | ✅ Fixed |
| U5 | **Nit.** Carousel dots have no focus ring; the unused `.dark` block keeps the old colour tokens; `fetchPriority` on the hero is redundant with `priority`. | site components | Left as is. | Accepted |

**Checked and fine:** the new colour tokens pass AA on white and on the muted background (6.3:1 and 5.7:1 for muted text; 6.0:1 for destructive); `.sr-text` is invisible on screen and in print and stays inside its scroll box; tap targets on the ticker and carousel are 32 px or more; no hard-coded UI text was added; every command, flag, path and bucket size in the deploy guide matches the repository.

## After the fixes

`lint` ✅ · `typecheck` ✅ · `build` ✅ · unit 526 ✅ · pgTAP 538 ✅ · `db lint` ✅ · bundle secret check ✅ · e2e 293 passed, 0 failed, 11 skipped by design (desktop-only or phone-only checks) · Lighthouse CI ✅ (home, mobile: 90 / 100 / 96 / 100).
