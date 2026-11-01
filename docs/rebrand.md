# Launching the template for a new school (under an hour)

Edumise BD is white-label: nothing about a school is in the code. A new school is a new Supabase project, a new Vercel project and about thirty minutes of settings. No code changes, no new build.

| Minute | Step | Where |
|---|---|---|
| 0–10 | Create the Supabase project, link, `db push`, production seed | `docs/deploy.md` steps 1–3 |
| 10–15 | Auth URLs, SMTP, access token hook | steps 4–5 |
| 15–20 | Create the super admin; deploy on Vercel with env vars | steps 7–8 |
| 20–25 | Sign in, change the password | |
| 25–40 | **School settings** (see below) | Dashboard → School settings |
| 40–50 | Session, sections, staff logins | Academic setup, Staff |
| 50–60 | Domain, smoke tests, hand over | steps 8.4 and the checklist |

## School settings: everything that carries the school's identity

Dashboard → **School settings** (super admin or admin):

- **Identity:** name in English and Bangla, short name (used in the logo mark when there is no logo), address in both languages.
- **Contact:** phone, email, website, Facebook and YouTube links, Google Maps embed link, office hours in both languages. Empty fields are hidden on the site.
- **Branding:** logo (PNG/JPG/WebP, up to 1 MB; shown in the header, on printed documents and the sign-in page), favicon, primary and secondary colours (the whole site and dashboard recolour at once; the colour must keep AA contrast on white, the form checks it).
- **Facts:** EIIN, institution code, centre code, year established (shown on the home page).
- **Head teacher:** name in both languages, photo, message in both languages (the home page section).

The site title, Open Graph data, sitemap, PDFs, receipts, mark sheets, certificates and emails all read these settings; nothing is hard-coded.

## What the production seed already set up

Classes 6–10 with one section each, groups (Science, Business Studies, Humanities), the national subject list with its class and group mapping, staff designations, eight periods, the four basic fee heads, the Bangladesh SSC grading scale, the website menu and empty draft pages. Change any of it in **Academic setup**, **Fees** and **Pages**; nothing is fixed.

## Things a new school usually changes in the first week

- **Academic setup → Sessions:** create the current session and mark it current. (Nothing can be billed, taught or marked without a current session.)
- **Sections:** add B, C… per class, set capacities and class teachers.
- **Subjects:** add or remove per the school's syllabus; fourth subjects per group.
- **Routine → Periods and working days:** the school's actual bell times and weekly off days.
- **Calendar:** the year's holidays (they count in attendance percentages).
- **Fees:** the fee structure per class and group, late fine, due days.
- **Pages and menu:** fill in the draft pages, publish, reorder the menu, hide what is not needed.
- **Grading scale:** only if the school grades differently. There is no form for it yet: it is the `grading` column of `school_settings` (a JSON list of bands, the Bangladesh SSC scale by default), changed with SQL in the Supabase dashboard.

## What stays the same for every school

The code, the tests and the CI. Each school is its own data and its own two projects; updates to the code reach every school through their Vercel projects when they pull the new version.

## Demo site

For a sales demo, deploy the same way but run the demo seed instead of the production seed (`npx supabase db push`, then `psql ... -f supabase/seed.sql` and the files in `supabase/seeds/` in order). It creates "Sunrise High School" with logins listed at the top of `supabase/seed.sql`; set `PAYMENT_SANDBOX_SECRET` there to show online payment. Never run the demo seed on a school's project.
