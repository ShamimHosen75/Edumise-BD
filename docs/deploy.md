# Deploying Edumise BD to production

One Supabase project and one Vercel project per school. Allow about an hour the first time. You need: a Supabase account, a Vercel account, the school's domain, an SMTP sender (for password-reset emails) and this repository.

Everything below uses the Supabase CLI (`npx supabase`, already a dev dependency) and the Vercel dashboard. Secrets are typed into dashboards or passed as environment variables; never commit them.

## 1. Create the Supabase project

1. In the Supabase dashboard, **New project**. Choose the region closest to Bangladesh (Singapore, `ap-southeast-1`), a strong database password, and the plan the school pays for (the free plan pauses after a week without traffic; use at least Pro for a school in session).
2. Note from **Project settings → API**: the project URL (`https://<ref>.supabase.co`), the **anon (publishable)** key and the **service_role (secret)** key.
3. Note from **Project settings → Database**: the connection string (`postgresql://postgres…`), for the one-off production seed.

## 2. Link the repository and push the schema

From a clone of the repository, on a trusted machine:

```bash
npx supabase login                    # opens the browser once
npx supabase link --project-ref <ref> # asks for the database password
npx supabase db push                  # applies every migration in supabase/migrations
```

`db push` creates every table, policy, function, trigger, storage bucket and the late-fine fee head. Check it with `npx supabase migration list`: every migration shows as applied remotely.

Never edit an applied migration. New changes are new files, pushed the same way.

## 3. Seed the production data (once)

The demo seed (`supabase/seed.sql` and `supabase/seeds/`) is for local work and demo sites only: it creates a fictional school with people, logins and bills. A real school gets the **production seed**, which creates only settings placeholders, the grading scale, classes 6–10, groups, subjects, designations, periods, fee heads, the website menu and empty draft pages:

```bash
psql "<connection string from step 1.3>" -f supabase/seed.prod.sql
```

It is safe to run once on a fresh project. It creates no session, no people and no logins.

## 4. Auth settings

In **Authentication → URL configuration**:
- **Site URL:** `https://<school domain>` (the password-reset links point here).
- **Redirect URLs:** `https://<school domain>/**` and, while testing, the Vercel preview URL `https://<project>-*.vercel.app/**`.

In **Authentication → Providers → Email**: keep **Confirm email off** (accounts are created by the office, not by sign-up) and make sure **Allow new users to sign up is OFF**. Minimum password length 8 and "letters and digits", as in `supabase/config.toml`.

In **Authentication → Emails → SMTP settings**: switch on **Custom SMTP** with the school's sender (an address on the school domain is best; Gmail "app passwords" also work for small schools). Without this, Supabase's built-in sender allows only a few emails an hour and they often land in spam. The only email the app sends is the password-reset link.

## 5. The custom access token hook

Users' roles travel inside their session token through a database function, so the hook must be switched on for the app to work:

1. **Authentication → Hooks (Beta) → Customize Access Token (JWT) Claims**.
2. **Enable**, type **Postgres**, schema `public`, function `custom_access_token_hook`, **Save**.

The migration already grants the Auth system the rights it needs (`supabase_auth_admin`). To check: sign in later, and the dashboard opens the role's home page. Without the hook, every sign-in says the account has no access.

## 6. Storage

`db push` created the two buckets (`public-media`, public, 5 MB; `private-docs`, private, 2 MB) with their access rules. Nothing to do. Uploaded files are served from `https://<ref>.supabase.co/storage/v1/...`; the app's security policy allows that origin automatically from `NEXT_PUBLIC_SUPABASE_URL`.

## 7. The first super admin

From a trusted machine (the service-role key bypasses every access rule):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
  node scripts/create-admin.mjs --email head@school.edu.bd --name "Abdul Karim" \
  --name-bn "আব্দুল করিম" --phone 017XXXXXXXX
```

It prints a one-time password. Give it to the person in private; they must change it at first sign-in. The super admin then creates admin, teacher and accountant logins from **Staff** in the dashboard (no other way to create a super admin exists, on purpose).

## 8. Deploy on Vercel

1. **Add New → Project**, import the GitHub repository. Framework preset: Next.js. Build command `npm run build`, Node.js 20.9 or newer (22 recommended).
2. **Environment variables** (Production, and Preview if you want preview deployments to work):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon (publishable) key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key (**Sensitive**) |
| `NEXT_PUBLIC_SITE_URL` | `https://<school domain>` (used in links and sitemaps) |
| `ADMISSION_TOKEN_SECRET` | `openssl rand -hex 32` (**Sensitive**) |
| `REVALIDATE_SECRET` | `openssl rand -hex 32` (**Sensitive**); only needed for cache refresh from outside the app (step 10) |
| `PAYMENT_SANDBOX_ALLOW_LIVE` | leave unset |
| `PAYMENT_SANDBOX_SECRET` | **leave unset** on production (test gateway) |
| `TRUSTED_PROXY_HOPS` | leave unset on Vercel |

3. **Deploy.** The first build takes a few minutes. Open the preview URL: the home page shows the placeholder school name, `/api/health` answers `{"status":"ok","db":"ok"}`.
4. **Domains:** add the school's domain, set the DNS records Vercel shows (A/CNAME), and wait for the certificate. Then set **Site URL** in step 4 to the real domain if you used the preview URL first.

The security headers (CSP, HSTS and the others) are sent by the app itself; nothing to configure on Vercel.

## 9. First sign-in and setup

1. Sign in at `https://<domain>/en/login` as the super admin, change the password.
2. **School settings:** names, address, phone, logo, favicon, colours, EIIN, head teacher's message.
3. **Academic setup:** create the session and set it current; check classes, sections, subjects.
4. **Staff:** add staff, designations, logins and teaching assignments.
5. **Website:** fill in the draft pages, publish them, add notices, sliders, gallery.
6. **Fees:** fee structure, late fine. Online payment stays off until a gateway account exists.

`docs/user-guide-en.md` / `docs/user-guide-bn.md` describe each role's tasks.

## 10. Backups and monitoring

- **Database:** Supabase Pro keeps daily backups for 7 days (Point-in-Time Recovery is an add-on). Take a manual dump before risky operations: `npx supabase db dump --linked -f backup.sql` (schema) and `--data-only` for data.
- **Files:** Storage is not in the database backups. Copy the two buckets periodically with the Supabase CLI or the dashboard, or an S3-compatible tool (Storage has an S3 endpoint).
- **Uptime:** point a monitor (UptimeRobot, Better Stack, or Vercel's own) at `https://<domain>/api/health` every 5 minutes. It returns 503 when the database is unreachable.
- **Cache refresh from outside the app:** `POST https://<domain>/api/revalidate` with `Authorization: Bearer <REVALIDATE_SECRET>` (never the service-role key: a webhook header is stored and logged) and `{"tags":["stats"]}` (tags: see `src/lib/site/cache.ts`), for example from a Supabase database webhook on `students`, so the home page counters change at once after a direct database edit.
- **Logs:** Vercel → Logs for the app; Supabase → Logs for Auth, Postgres and Storage.

## 11. Updates

Push to `main`: GitHub Actions runs lint, typecheck, unit, database and browser tests, the bundle secret check and Lighthouse; Vercel builds the new version. Schema changes: add a migration file, `npx supabase db push` **before** the deploy that needs it.

## Checklist for going live

- [ ] `npx supabase migration list` shows every migration applied
- [ ] production seed run once; demo seed never run on this project
- [ ] Site URL and redirect URLs set; sign-up off; custom SMTP on and tested with a password reset
- [ ] access token hook enabled; a sign-in reaches the dashboard
- [ ] super admin created; one-time password changed
- [ ] Vercel env vars set; `PAYMENT_SANDBOX_SECRET` and `PAYMENT_SANDBOX_ALLOW_LIVE` absent
- [ ] custom domain with HTTPS; `/api/health` is `ok`
- [ ] smoke tests pass against the site: `E2E_BASE_URL=https://<domain> npx playwright test tests/e2e/smoke-prod.spec.ts`
- [ ] uptime monitor on `/api/health`; backup schedule agreed
