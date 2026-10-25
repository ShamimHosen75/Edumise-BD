# Phase 2 code review

Scope: `git diff 77052d0..HEAD` (Steps 2.1–2.4): 181 files, about 17,000 lines.
Reviewed 2026-10-25 as a strict senior reviewer, in four parts (security, public-site
correctness, dashboard correctness, performance/maintainability/UX). Every finding below
was checked against the code; the two medium security findings were reproduced against
the local Supabase before fixing. Security and correctness items were fixed in the same
change, each with a regression test.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | Anyone with the public key could list every file in `public-media` through the Storage API, and so find attachments of draft, staff-only and class notices and unpublished downloads by name (reproduced). | `supabase/migrations/20261024001800_rls_storage.sql` ("anyone reads public media") | Dropped the anon select policy. A public bucket still serves files by URL; only admins (all files) and teachers (their own notice folder) can list. | ✅ Fixed | pgTAP `240_phase2_review` "anon cannot list public-media files"; e2e downloads/notice files still load |
| S2 | A teacher could set `attachment_path` on their own draft to any file (e.g. the school logo) through the API; when an admin later deleted or replaced the draft, that file was deleted. | `20261024002200_content_modules.sql` teacher policies; `[module]/actions.ts` → `removeFiles` | Trigger: non-admins may only attach files from `notices/<own id>/` (no `..`). App deletes only paths under the item's own folder (`deletablePaths`), everywhere files are removed. | ✅ Fixed | pgTAP `240_phase2_review` (4 checks); unit `deletablePaths` |
| S3 | Row ids sent to server actions were not validated (only typed). Page and album ids go into storage paths. | all dashboard action files | `assertId` / `assertOptionalId` (Zod) at the start of every action that takes an id. | ✅ Fixed | unit `assertId` (8 bad inputs) |
| S4 | Pages list crashed (500) on `?q=a&q=b` and did not strip `*`. | `dashboard/pages/page.tsx` | Uses the shared `cleanSearch`. | ✅ Fixed | — |
| S5 | Contact rate limit trusts `X-Forwarded-For`. Safe on Vercel (it overwrites the header); spoofable behind other proxies. | `src/lib/rate-limit-keys.ts` | Documented: deploy on Vercel, or set the proxy to overwrite the header. | 📝 Noted for 6.4 | — |
| S6 | Teachers can upload to their folder directly (skipping the byte check; Storage still only takes PNG/JPG/WebP/PDF ≤ 5 MB) and cannot delete files they uploaded. | teacher storage policy | Accepted: no executable types possible; orphan files are a clean-up task. | 📝 Accepted | — |

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | A list page past the end (`/en/notices?page=99`, old links) showed the error page: PostgREST answers 416 / PGRST103. | `src/lib/site/content-data.ts` (all lists) | Not an error any more; the total is read from the message and the page redirects to the last page. Dashboard lists show an empty page. | ✅ Fixed | e2e "a list page past the end goes to the last page"; unit `lastPage` |
| C2 | A database blip during revalidation cached a 404 for an existing notice/news/event/album/download/page/profile for up to an hour. | `src/lib/site/cache.ts` (fallback `null`) | Detail loaders (`cachedDetailQuery`) throw instead, so Next keeps the last good page. | ✅ Fixed | — |
| C3 | Scheduled items appeared up to an hour late; an early visit cached a 404 for an hour. | detail loaders, home ticker, sitemap (`revalidate 3600`) | Detail pages, home notices/events and the sitemap refresh every 5 minutes. | ✅ Fixed | — |
| C4 | Every list page told search engines that its Bangla version was the home page (`/bn`), inherited from the root layout. | `src/app/[lang]/layout.tsx` | Each page sets its own canonical and hreflang (`pageAlternates`); the layout no longer does. | ✅ Fixed | unit `pageAlternates`; e2e "list pages name their own…" |
| C5 | A Bangla CMS page showed the English SEO title when only `seo_title_en` was set. | `p/[slug]/page.tsx` | `pageSeo`: in Bangla any Bangla text wins, then English. | ✅ Fixed | unit `pageSeo` |
| C6 | The home page dropped an event once it started; `/events` still listed it as upcoming. | `src/lib/site/data.ts` | Same rule on both: not started yet, or still running. | ✅ Fixed | — |
| C7 | Excerpts showed `&lt;` instead of `<` (cards, meta descriptions). | `src/lib/content/excerpt.ts` | Entities decoded (`&amp;` last, so nothing is decoded twice). | ✅ Fixed | unit `excerpt` (3) |
| C8 | "Link copied" showed even when copying failed (no clipboard on plain http). | `share-buttons.tsx` | Shows the link in a prompt to copy by hand instead. | ✅ Fixed | — |
| C9 | Clearing the date of a scheduled item did not publish it now (the form hint says it does). | `src/lib/validation/content.ts` `publishedAt` | A future date is replaced by now; a past first-publish date is kept. | ✅ Fixed | unit `publishedAt` |
| C10 | Unpublishing a CMS page threw away its first publish date. | `dashboard/pages/actions.ts` | Kept, as for other content. | ✅ Fixed | — |
| C11 | A teacher saving their draft erased a publish date an admin had set on it. | `src/lib/content/rows.ts` | Teachers' saves keep the stored date. | ✅ Fixed | unit `toContentRow` |
| C12 | Page editor and menu builder: a thrown save/delete (network error) gave no message; some deletes of an already-deleted item said "Saved". | `page-editor.tsx`, `menu-builder.tsx`, `content-form.tsx`, `person-form.tsx`, `pages/actions.ts`, `menu/actions.ts` | Errors caught and shown; deletes/updates check a row was changed. Menu reorder updates run together. | ✅ Fixed | — |
| C13 | Replaced/removed files left behind (page covers, page folders on delete, album covers, person photos, failed uploads). | `pages/actions.ts`, `[module]/actions.ts`, `photo-actions.ts`, `people-actions.ts` | Old and failed files are deleted (only from the item's folder; an album cover that is also a photo is kept). | ✅ Fixed | e2e upload/delete flows |
| C14 | Former head teacher "to year" limit was fixed when the server started (wrong after New Year). | `src/lib/validation/people.ts` | Checked on each use. | ✅ Fixed | unit years |
| C15 | Dashboard lists showed "Nothing here yet" when the database read failed. | `[module]/page.tsx`, `pages/page.tsx` | Errors now show the error page. | ✅ Fixed | — |

## Performance

| # | Finding | Where | Status |
|---|---|---|---|
| P1 | Missing indexes for public notice list (audience, pinned, date), teacher notice list (`created_by`), downloads by date, gallery preview by date, `events.album_id`. | migrations | ✅ Added in `20261025002400_phase2_review_fixes.sql` |
| P2 | Full-width images without `sizes` made phones download 1200 px images. | `p/[slug]`, `file-attachment.tsx` | ✅ Fixed |
| P3 | `/teachers` and `/governing-body` read the query string for their tabs, so the HTML is rendered per request (data is cached). | site pages | 📝 Later (Step 6.3): move tabs to path segments if needed |
| P4 | Content forms without a body (downloads, albums) still load the editor bundle. | `content-form.tsx` | 📝 Later: `next/dynamic` for `RichField` |
| P5 | Home page fetched a whole page body to check the head teacher's message exists. | `(site)/page.tsx` | ✅ Fixed (`getPageLink`) |

## Maintainability (recorded, not changed now)

| # | Finding | Suggested fix |
|---|---|---|
| M1 | Each action file has its own admin guard and Zod-error loop; result types repeated. | Shared `lib/actions` helpers (`requireAdmin`, `zodFieldErrors`, result types) when Step 3.1 adds the FormDialog pattern. |
| M2 | `check()` / `db()` repeated in three `lib/site` data files; `cleanSearch` lives in `share.ts`. | Move to `lib/site/query.ts` and `lib/content/search.ts`. |
| M3 | `imageExtension()` is also used for PDFs. | Rename to `fileExtension`. |
| M4 | `getSliders` selects `link_url` that is never shown. | Render slide links or drop the column (decide with the owner). |
| M5 | `toPhotos`, `contentLabels`, `cmsMessages` have no unit tests. | Add with the next change to them. |

## UX / i18n

| # | Finding | Status |
|---|---|---|
| U1 | "PDF" and the "(type, size)" punctuation on page attachments were hard-coded. | ✅ Dictionary template `site.page.fileMeta` |
| U2 | Arrows in back links ("←", "→") were read aloud by screen readers. | ✅ `aria-hidden` |
| U3 | The dashboard content table scrolls sideways at 360 px but could not be focused to scroll by keyboard. | ✅ Focusable region with a label |
| U4 | Slide dots are 10 px (touch target below 24 px); date-range dashes are literal. | 📝 Step 6.3 accessibility pass |
