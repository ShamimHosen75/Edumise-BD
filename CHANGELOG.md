# Changelog

## 1.0.0 — 2026-11-01

First release: a white-label, bilingual (English/Bangla) website and management system for Bangladeshi secondary schools (Class 6–10). One codebase, one Supabase project per school.

### Website

- Public site: home page (slider, notice ticker, facts, head teacher's message, teachers, live counters, class chart, events, gallery), CMS pages with a menu builder, notices, news, events, gallery, downloads, teachers and staff directory, governing body, former head teachers, contact form, class and exam routines, academic calendar, public result search, board exam results, certificate verification, online admission with status check. Sitemap, robots, Open Graph.
- Fully bilingual with Bangla digits; the school's name, logo, colours and details come from settings.

### Management

- Roles: super admin, admin, teacher, accountant, student, guardian; dashboard per role; logins with one-time passwords; forced password change; password reset by email.
- Academic setup: sessions, classes, sections, groups, subjects, class-subject mapping.
- Staff: profiles with private details kept off the website, designations, teaching assignments, logins.
- Admissions: online application queue, test scheduling, merit list, approval that creates student, guardian and login.
- Students: profiles, guardians, documents, ID cards, CSV import, year-end promotion, student and guardian portals.
- Routine: periods, working days, clash-checked routine builder, teacher routines, exam schedule, holidays.
- Attendance: phone-first taking by teachers, monthly sheets with Excel export, family calendars, admin widget.
- Exams and marks: exam setup, marks entry with autosave, submit and lock, Excel import, grading (Bangladesh SSC scale, configurable in the database), result processing, tabulation sheets, mark sheet PDFs, publishing to the portal and the public search.
- Certificates: testimonial, transfer and character certificates with QR verification and revocation.
- Fees: fee heads, structure per class and group, waivers with admin approval, late fine, invoice generator, collection with receipts (amount in words in English and Bangla, QR, PDF), cancellation by admins, reports (daily, dues, income, ledger) in Excel and PDF, family fee pages, online payment framework with a manual provider and a sandbox gateway (bKash, Nagad, SSLCommerz stubs).

### Quality

- Tests: 525 unit, 526 database (pgTAP, RLS) and 283 browser tests (desktop and 360px phone, English and Bangla), including five day-in-the-life scenarios.
- Security: RLS on every table, roles checked on the server and in the database, security headers, rate limits, server-side upload checks, bundle secret check, a security audit with every finding fixed (`docs/security-report.md`).
- Performance and accessibility: Lighthouse (mobile) 90+ on every category of the main pages, Lighthouse CI, axe with no serious violations, every screen at 360px, print styles.
- Operations: health check (`/api/health`), on-demand cache refresh (`/api/revalidate`), production seed, first-admin script, deploy guide, rebrand guide, user guides in both languages.
