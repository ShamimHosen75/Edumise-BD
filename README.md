# Edumise BD

A white-label, bilingual (English/Bangla) school website and management system for
Bangladeshi secondary schools (Class 6–10). One codebase, one Supabase project per school.

- Requirements: [docs/requirements.md](docs/requirements.md)
- Build progress: [docs/progress.md](docs/progress.md)
- Project rules for contributors and Claude: [CLAUDE.md](CLAUDE.md)

## Local setup

Requires Node.js 22 and Docker.

```bash
npm install
npm run db:start            # starts local Supabase in Docker; prints the URL and keys
cp .env.example .env.local  # paste the anon and service-role keys printed above
npm run dev                 # http://localhost:3000 -> redirects to /en
```

## Scripts

| Script                         | What it does                                             |
| ------------------------------ | -------------------------------------------------------- |
| `npm run dev`                  | Dev server                                               |
| `npm run build` / `npm start`  | Production build / serve it                              |
| `npm run lint`                 | ESLint (no warnings allowed)                             |
| `npm run typecheck`            | TypeScript, strict                                       |
| `npm run test`                 | Unit tests (Vitest)                                      |
| `npm run test:e2e`             | E2E tests (Playwright; builds and starts the app itself) |
| `npm run db:start` / `db:stop` | Start / stop local Supabase                              |
| `npm run db:reset`             | Re-apply all migrations and the seed                     |
| `npm run db:test`              | Database tests (pgTAP)                                   |
| `npm run db:types`             | Regenerate `src/lib/supabase/database.types.ts`          |
