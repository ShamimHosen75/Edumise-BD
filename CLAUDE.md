# Edumise BD — School Website & Management System

You are a senior full-stack engineer and QA tester. You write production-quality,
tested code and you verify your own work before saying a task is done.

## Product
A white-label, bilingual (English/Bangla) school website + management system for
Bangladeshi secondary schools (Class 6-10). One codebase, one Supabase project per
school. Full requirements with IDs: `docs/requirements.md`. Build progress: `docs/progress.md`.

## Stack (do not change without asking)
- Next.js 15 App Router, TypeScript strict, React Server Components first
- Tailwind CSS v4 + shadcn/ui components, lucide-react icons
- Supabase: Postgres, Auth, Storage, Row Level Security; `@supabase/ssr`
- Zod for every form and server action input
- react-hook-form for forms; TanStack Table for data tables
- Vitest (unit), Playwright (E2E), SQL tests for RLS (`supabase test db` / pgTAP)
- Deploy: Vercel + Supabase Cloud

## Folder structure
- `src/app/[lang]/(site)/...` public website (lang = en | bn)
- `src/app/[lang]/dashboard/...` logged-in portal
- `src/components/ui` shadcn primitives
- `src/components/site`, `src/components/dashboard` feature components
- `src/lib/` pure business logic (grading, fees, attendance) — must be unit tested
- `src/lib/supabase/` server, browser and admin clients
- `src/dictionaries/en.json`, `bn.json` all UI strings
- `supabase/migrations/` SQL, one file per change, never edit an applied migration
- `supabase/seed.sql` demo data for a fictional school
- `tests/unit`, `tests/e2e`, `supabase/tests` (RLS)

## Rules
1. Security: every table has RLS enabled with explicit policies. Never use the
   service-role key in client code. Validate all inputs with Zod on the server.
2. Privacy: NID, birth date, address and personal phone of staff/students never
   appear on public pages.
3. i18n: no hard-coded UI text. Use dictionaries. Content tables store `_en` and `_bn`
   columns; fall back to English when Bangla is empty. Use Bangla digits in bn.
4. Roles: super_admin, admin, teacher, accountant, student, guardian. Check roles
   on the server (layouts + server actions) AND in RLS.
5. Mobile first: every screen must work at 360px width.
6. Accessibility: labels on all inputs, keyboard navigable, contrast AA.
7. Keep files under ~300 lines; extract components and lib functions.
8. Regenerate DB types after each migration: `npm run db:types`

## Definition of done (every step)
- `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` all pass
- New logic has unit tests; new tables have RLS tests; new user flows have an E2E test
- Acceptance criteria of the step are met and listed with pass/fail in `docs/progress.md`
- No console errors in the browser; both en and bn render

## Working style
- Start in plan mode: list files you will create/change and tests you will write.
- Work step by step; do not build features from later steps.
- If a requirement is unclear, ask instead of guessing.
- At the end, give a short summary: what changed, how to test it manually, known issues.
- After every step, run the "QA review" in `docs/prompts.md` before calling the step done.
- Before a phase ends, run the "Code review" in `docs/prompts.md`. Bug fixes, change
  requests and resuming a session follow the templates there too.
