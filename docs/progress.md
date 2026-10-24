# Build progress

| Step | Status | Notes |
|---|---|---|
| 1.1 Project setup | ✅ Done | See below |
| 1.2 Schema + seed | Not started | Requirements are a draft awaiting review |
| 1.3 RLS policies | Not started | Blocked on 1.2 |
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
