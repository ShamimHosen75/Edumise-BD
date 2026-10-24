# Phase 1 code review

Scope: `git diff d5992c7..HEAD` (Steps 1.1–1.5): 118 files, about 8,600 lines.
Reviewed 2026-10-24 as a strict senior reviewer. Security and correctness items were fixed
in the same change; each fix has a regression test.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | A user could clear `must_change_password` on their own profile through the API and skip the forced password change. | `supabase/migrations/20261024001400_auth_helpers.sql` (`app.protect_profile`) | Only admins / trusted server code may change the flag; the server clears it after a forced change. | ✅ Fixed | `supabase/tests/160_security_review.test.sql` |
| S2 | Any logged-in session could set a new password without the current one, so a stolen session could take over the account. | `src/app/[lang]/(auth)/actions.ts` (`updatePassword`), `password-page.tsx` | Allowed only for a forced change or within 15 minutes of opening a reset link (token `amr`). | ✅ Fixed | `tests/unit/security-rules.test.ts`; e2e "a normal session cannot use the password pages" |
| S3 | No app-level login limit. In production all logins reach Supabase from the server's IP, so Supabase's per-IP limit would treat the whole school as one visitor (30 failed logins by anyone → everyone locked out). | `actions.ts` (`signIn`) | Database-backed limiter: 300 attempts / 5 min per IP (school labs share an IP), 10 failures / 15 min per account. Keys are SHA-256 hashed. | ✅ Fixed | pgTAP `160_security_review`; unit `security-rules`; e2e "too many wrong passwords…" |
| S4 | Forgot-password could be used to flood someone's inbox. | `actions.ts` (`requestPasswordReset`) | 10 / hour per IP, 3 / hour per email; same answer either way. | ✅ Fixed | unit `security-rules` (keys); limiter pgTAP |
| S5 | Reset-link address built from the request's `Origin` header (Supabase's redirect allow-list limits the damage). | `actions.ts` | Prefer `NEXT_PUBLIC_SITE_URL`; added to `.env.example`. | ✅ Fixed | — |
| S6 | Anon could read `staff.profile_id` (internal login id). | RLS on `staff` | Anon gets column-level access to public columns only. | ✅ Fixed | pgTAP "anon cannot read staff.profile_id" |

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | A light main colour (e.g. yellow) would make text and links unreadable on white, breaking the AA rule. | `src/lib/validation/school-settings.ts` | Main colour must have ≥ 4.5:1 contrast with white (Bangla/English error message). | ✅ Fixed | unit "main colour readability" |
| C2 | Logo did not load locally: Next's image optimizer refuses local (127.0.0.1) Supabase addresses. | `src/app/[lang]/(site)/page.tsx` | Logo served directly (`unoptimized`, it is small). | ✅ Fixed | e2e logo test now checks the image really loads |
| C3 | The logo e2e test left an uploaded logo in the local database. | `tests/e2e/dashboard.spec.ts` | `afterAll` resets `logo_path`. | ✅ Fixed | — |

## Performance (not changed now)

| # | Finding | Where | Suggested fix |
|---|---|---|---|
| P1 | The teacher marks policy calls `app.teacher_teaches()` per row. Fine for one school's data, slower for very large exams. | `20261024001700_rls_records.sql` | In Step 4.2, precompute the teacher's (section, subject) pairs once per query, as done for sections. |
| P2 | Every dashboard request asks Supabase Auth to confirm the session (`getUser`). | `src/lib/auth/session.ts` | Correct for security; revisit only if dashboard latency becomes a problem. |

## Maintainability (not changed now)

| # | Finding | Where | Suggested fix |
|---|---|---|---|
| M1 | Replaced logos stay in storage. | `settings/actions.ts` | Delete the previous file after a successful save (Step 2.x media work). |
| M2 | Client components import server actions from `src/app/...`. | `src/components/auth/*`, `settings-form.tsx` | Move actions to `src/server/actions/` when more are added. |
| M3 | `authInterrupts` (for real 403 pages) is an experimental Next.js flag. | `next.config.ts` | Re-check on each Next upgrade. |

## UX / i18n (not changed now)

| # | Finding | Where | Suggested fix |
|---|---|---|---|
| U1 | Dashboard pages share one browser tab title. | role home pages | Add per-page titles with the dashboard pages in later steps. |
| U2 | The year field shows Western digits while typing in Bangla (browser number input). | settings form | Accept Bangla digits in a text input in a later polish pass. |
| U3 | 404 / 403 pages have no site header and footer yet. | `not-found.tsx`, `forbidden.tsx` | Comes with the site shell in Step 2.1. |

## Production note

Because the app now limits logins itself, the Supabase project's own sign-in rate limit
must be raised (Dashboard → Authentication → Rate limits), or all users will share
Supabase's per-IP limit through the server. To be written into `docs/deploy.md` in Step 6.4.

## Result after fixes

`lint` ✅ · `typecheck` ✅ · `test` ✅ 141 · `db:test` ✅ 12 files / 170 tests · `db lint` ✅ ·
types up to date ✅ · `build` ✅ · `test:e2e` ✅ 72 passed (2 skipped by design).
