# Security audit (Step 6.2, NFR-01, NFR-02)

**Audited:** `main` at `b2a0c5d`, 2026-10-31. Tested as a penetration tester on our own code, in three parts:
- **database and IDOR:** run as each real role against the local Supabase, in transactions that were rolled back, and through the Data API with a real user's token;
- **application:** every server action and route handler, called directly against the production build, signed out and with the wrong roles;
- **website and build:** the HTTP headers, the browser bundles, and a crawl of the whole public site.

**Result:** no Critical or High findings. The two Medium and all Low findings were fixed with regression tests. The database fixes are in a new migration, `20261103004000_security_audit_fixes.sql`; applied migrations were not edited.

## Findings

| # | Severity | Area | Finding | Fix | Status | Regression test |
|---|---|---|---|---|---|---|
| H1 | Medium | Headers | No security headers were sent: no CSP, X-Frame-Options or Referrer-Policy. Pages could be framed (clickjacking), and nothing limited where scripts, frames or objects load from. | `next.config.ts` sends, on every response: a Content Security Policy (`default-src 'self'`; images, PDFs and media from Supabase storage only; frames from Google Maps only; `frame-ancestors 'none'`; `object-src` limited to the site and storage; `base-uri` and `form-action 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and HSTS. Scripts and styles allow `'unsafe-inline'`, because Next.js needs inline scripts without per-request nonces, and nonces would make every page dynamic. | ✅ Fixed | e2e `security-headers.spec.ts`: headers on pages, sitemap and API; public and dashboard pages load with no CSP violations |
| D1 | Medium | Database | A switched-off student or guardian login could still read the family's data through the Data API. The "own data" helpers did not check `is_active` or the role. The user could get a new token with the public key, or keep refreshing an old one. | (1) `app.my_student_id()`, `app.guardian_student_ids()` and `app.my_staff_id()` now require an active profile with the matching role. (2) Switching a login off also bans it in Supabase Auth (`setLoginBlocked`), so it cannot get or refresh a token. Switching it back on lifts the ban. A banned login gets the same answer as a wrong password: Supabase says "banned" even for a wrong password, so a clearer message would reveal which logins exist. | ✅ Fixed | pgTAP `400`: a switched-off guardian or student sees no students, bills, payments, attendance, marks or results. e2e `students.spec.ts`: after "Switch off", API sign-in fails; after "Switch on", it works again. |
| A1 | Medium | Login | Anyone could lock students and guardians out. Ten wrong passwords locked an account for everyone, even the owner with the right password. Student IDs are predictable and guardian logins are mobile numbers. | Failures are counted per account **and address** (10 per 15 min), plus a much higher total per account (100 per hour). Someone guessing from one place is stopped, but cannot lock the owner out from another place. | ✅ Fixed | unit `security-audit.test.ts` "failures from one address do not lock the owner out…"; e2e `auth.spec.ts` "too many wrong passwords…" still passes |
| A2 | Low | Login | The failure limit could be split: `2026060001` and `student-2026060001@student.invalid` (or a staff phone and email) each had their own counter. | The counters are keyed by the account the identifier resolves to (its sign-in email). | ✅ Fixed | unit "one account shares its counters however it is typed" |
| A3 | Low (depends on hosting) | Rate limits | Every per-address limit trusted the first `X-Forwarded-For` entry, which the client can write when self-hosted. | `clientIp()` prefers Vercel's `x-vercel-forwarded-for`. Behind other proxies, `TRUSTED_PROXY_HOPS` picks the address that many entries from the right. To be documented in `docs/deploy.md` (Step 6.4). | ✅ Fixed | unit `clientIp` tests (spoofed left-most entry ignored) |
| A4 | Low | Login | Login took longer for a mobile number that has an account, so accounts could be found by timing. | An unknown number still makes one password check (against a dummy address), with the same message. | ✅ Fixed | — (timing) |
| D2 | Low | Database | A teacher newly given a section could read earlier years' attendance and results for that section. Sections carry over between years. | Teachers see attendance only for this session's students of their sections, and results only for this session's exams. | ✅ Fixed | pgTAP `400` "in a new session, earlier years' attendance… and results are hidden" |
| D3 | Low | Database | Any signed-in user could rename their own profile. Receipts print the receiver's name, so an accountant could sign receipts as "Principal". | Only an admin changes a profile's names or photo (`app.protect_profile`). No screen let users edit their own name. | ✅ Fixed | pgTAP `400` and `160` (accountant and student refused; admin allowed) |
| A5 | Info | Payments | The test payment gateway was refused only on Vercel production. A self-hosted live site with its secret set would accept test "payments". | Also refused when `NEXT_PUBLIC_SITE_URL` is a public https address, unless `PAYMENT_SANDBOX_ALLOW_LIVE=1` is set on purpose. | ✅ Fixed | unit "is refused on a live site unless allowed on purpose" |
| A6 | Info | Validation | Two inputs were checked by hand instead of with Zod: page attachment labels and album photo captions. | Zod schemas (CLAUDE.md rule 1). | ✅ Fixed | — |
| A7 | Info | XSS | The rich-text image rule was a prefix check, so `public-media/../../auth/v1/x` passed. Only admins and teachers write rich text, and an image fetch carries no credentials. | Paths with `..` (plain or encoded) or encoded slashes are dropped. | ✅ Fixed | unit "drops paths that step out of the bucket…" |
| D5 | Info | Database | `anon` and `authenticated` held TRUNCATE (which ignores RLS), REFERENCES and TRIGGER on every table (Supabase default). PostgREST cannot use these, so this was not reachable. | Revoked, including for future tables. | ✅ Fixed | pgTAP `400` |
| D4 | Info | Privacy | Teachers can read their own sections' guardian NID and address, and students' birth registration number and birth date. | As designed in the role matrix ("R own sections"), and never public. Column-level limits could be added later as data minimisation. | 📝 Later | — |
| D6 | Info | Tests | The catalogue tests did not cover public security-definer functions, view rights, or which functions visitors can run. | Added. | ✅ Fixed | pgTAP `400` (3 catalogue checks) |

## Checklist from the step

| Check | Result |
|---|---|
| Tables, views and functions without RLS or with broad policies; SECURITY DEFINER without a fixed `search_path`; `supabase db lint` | ✅ RLS is on all 61 public tables and `app.rate_limit_hits`, with 126 explicit policies. Both views are `security_invoker`. All 53 security-definer functions (public and app) use `search_path=''`. `db lint --level warning` is clean. Only `public` and `graphql_public` are exposed. Fixes: D1, D2, D3, D5. |
| Service-role key or secrets in browser bundles | ✅ None. `scripts/check-bundle-secrets.mjs` checks `.next/static` for secret names, the service-role JWT marker and every secret value in `.env.local`, and fails the CI build if one appears. It caught a planted key when tried. |
| Every server action and route handler: auth, role, Zod | ✅ About 120 server actions in 37 files and 9 route handlers were reviewed. Each checks the role itself (layouts do not cover them) and validates input with Zod (A6 fixed the last two). The service-role client is used only after validation and rate limits (public forms) or after role and target checks (accounts). |
| IDOR: other students, invoices, applications | ✅ Every attempt was refused, as guardian, student, teacher, accountant and admin, including RPCs with other people's IDs. Receipts and PDFs from another family return 404. |
| File uploads: type and size checked on the server; private bucket via signed URLs | ✅ Files are checked by magic bytes (PNG, JPEG, WebP, PDF; never SVG), with size limits on the server and server-built paths (random UUIDs). `private-docs` is admins only, through 10-minute signed links made with the user's own client. Public admission uploads need an HMAC token and a per-application limit. |
| XSS (rich text, notice titles); CSRF on route handlers; rate limits | ✅ Rich text is sanitised on save and on render (19 payloads tried; A7 fixed). Titles are rendered as text. The only POST route (the webhook) uses no cookies and is HMAC-signed. Server actions have Next's origin check. GET handlers change nothing. Rate limits cover login, password reset, contact, admission submit and status, result search, certificate verify and online payment. A1–A3 were fixed. |
| Personal data on public pages | ✅ e2e `privacy-crawl.spec.ts` crawls every public page in the sitemap, plus the forms (over 80 pages per language), in English and Bangla. It asserts that no NID, birth date (in every format), birth registration number, address, or personal or guardian phone from the database appears. |
| Security headers | ✅ H1 fixed (see above). |

## Assumptions and notes for deployment

- **Behind a proxy other than Vercel:** set `TRUSTED_PROXY_HOPS`, otherwise per-address limits can be bypassed (A3).
- **`PAYMENT_SANDBOX_SECRET`:** never set it on a live site. A5 refuses it there in any case.
- **CSP:** it allows `'unsafe-inline'` for scripts and styles (see H1). React escapes user text and rich text is sanitised, so this is a second layer, not the first.
- **Teacher access:** teachers keep reading their own sections' private columns (D4), as the role matrix allows.

## Test results after the fixes

- `lint` ✅, `typecheck` ✅.
- Unit ✅ 525 (new: `security-audit.test.ts`).
- pgTAP ✅ 33 files / 526 tests (new: `400_security_audit`).
- `db lint` ✅. The bundle secret check ✅ (183 client files).
- e2e ✅ 279 passed, 0 failed, 7 skipped by design. New: `security-headers.spec.ts`, `privacy-crawl.spec.ts`, and the `students.spec.ts` switch-off check.
- During the run, the CSP blocked the seeded demo notices' inline PDF preview (a PDF served by the site itself). `object-src` now allows `'self'`, and the CSP test now opens such a notice.
