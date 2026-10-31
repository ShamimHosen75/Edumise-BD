# Phase 5 code review

**Scope:** `git diff aaff54a..1eb666b`, covering Steps 5.1–5.3:
- fee setup and invoices;
- collection, receipts and reports;
- online payment.

That is 100 files and about 10,800 lines. Reviewed 2026-10-31 as a strict senior reviewer, in four parts:
- security;
- correctness of fee setup;
- correctness of collection and online payment;
- performance, maintainability and UX.

**How findings were checked:** against the code, and the database ones against the local Supabase as the seeded users, in transactions that were rolled back.

**Fixes:** security and correctness items were fixed in this change, with regression tests:
- pgTAP: `390_phase5_review`;
- unit: `review-phase-5.test.ts` and `fees.test.ts`.

Database fixes are in a new migration, `20261102003900_phase5_review_fixes.sql`. Applied migrations were not edited.

## Security

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| S1 | **High.** The office and accountant roles could write bills directly through the API. Each of these succeeded as the accountant: zero a bill and mark it "paid" (the classic "take cash, record nothing"); give an item a 100% waiver without an admin's approval; add a "paid" bill; move a bill to another student; delete a bill. The Step 5.2 guards only covered `paid`. | `invoices` and `invoice_items` policies (FOR ALL) | Staff now only read bills. Every change goes through the database functions: generate, pay, cancel. | ✅ Fixed | pgTAP 390 (four checks), 130, 370 |
| S2 | **High.** `create_invoices` trusted the amounts and waivers sent to it. A direct call could bill Tk 0 with a 100% waiver, and that used up the period so the real bill could never be made. | `create_invoices` | The function works out amounts itself: the student's group or class amount, plus approved waivers, using the rule in `fees.ts`. Amounts that are sent are ignored. | ✅ Fixed | pgTAP "the class amount and his approved half waiver are used" |
| S3 | **Medium.** The test gateway (sandbox) would take "payments" with no money if its secret were set on the live site. | `payments/sandbox.ts` | Never available when `VERCEL_ENV=production`. | ✅ Fixed | unit |
| S4 | **Low.** Students could start online payments. The step says guardians, and a student and a guardian kept replacing each other's payments. | `create_payment_intent`, payment actions | Guardians only, in the database and on the server. | ✅ Fixed | pgTAP |
| S5 | **Low.** The webhook body limit trusted `Content-Length`. A chunked body was read whole. | webhook route | The body is read with a byte counter and stops at 16 KB. | ✅ Fixed | — |
| S6 | **Low.** Starting payments had no rate limit, and each start writes an audit row. | payment actions | 20 per hour per account. | ✅ Fixed | — |
| S7 | **Info.** `app.next_invoice_no` kept the default PUBLIC execute. The `app` schema is not exposed, so this was not reachable. | fees setup | Revoked. | ✅ Fixed | pgTAP |

**Checked and fine:**
- Teachers see no fee data.
- Families see only their own bills, payments and intents.
- `payments` and their allocations have no write policies.
- The webhook functions run with the service role only.
- Every security-definer function has a fixed `search_path`.
- The `edumise.payment` flag cannot be set by a user.
- HMAC is compared in constant time.
- Replays are idempotent.
- The student search uses safe filters, not `.or()` strings.
- Receipts, PDFs and exports check the role and go through RLS.
- The guardian phone appears only in the staff dues report.

## Correctness

| # | Finding | Where | Fix | Status | Test |
|---|---|---|---|---|---|
| C1 | **High.** An online "pay all" could end up part paid. The fine was worked out on the day the payment was started, but frozen on the day the gateway confirmed (after midnight, it had grown). The shortfall was recorded silently. | `apply_payment`, `complete_payment_intent` | The fine is worked out for the day the payment was started. An online payment must equal what is owed exactly; otherwise nothing is recorded and the office refunds. | ✅ Fixed | pgTAP "a payment confirmed the next day…" |
| C2 | **High.** Gateway IDs were rewritten lossily (upper case, other characters turned into "-"). Two IDs could clash, for example `abcd1234` and `ABCD1234`, or a bKash ID already entered at the office. The duplicate-key error was not caught, so the webhook failed for ever: money taken, nothing recorded, nothing flagged. | `complete_payment_intent` | The gateway's ID is stored as sent (`payments.gateway_txn_id`). `txn_id` holds a fixed-length digest of the provider and the ID. A clash is also caught (nothing recorded, kept for a refund). | ✅ Fixed | pgTAP |
| C3 | **Medium.** Gateway IDs over 40 characters always failed, and were reported as "bills changed". | same | Fixed by C2: the ID can be up to 100 characters. | ✅ Fixed | — |
| C4 | **Medium.** A failed intent could still become paid on a later retry, even after the office had refunded it. | `complete_payment_intent` | A failed intent is final. A later "paid" message records nothing and is written to the audit log. | ✅ Fixed | pgTAP "a closed intent is final" |
| C5 | **Medium.** The late fine was frozen on every ticked bill, even one the money never reached. That fine then stopped growing, and stayed after a cancellation. | `apply_payment` | Bills are paid oldest first, and a bill's fine is frozen just before money reaches it. | ✅ Fixed | pgTAP "the later bill… keeps a live fine" |
| C6 | **Low–medium.** A frozen fine left on its own could not be collected: its tick box was always disabled. This happens when a payment that covered only the fine is cancelled. | `due-item-list.tsx` | A frozen fine with no fees left on its bill can be ticked. | ✅ Fixed | unit |
| C7 | **Low.** A collect screen opened before midnight (or before the fine rule changed) could save a different total than it showed. | `record_payment`, collect form | The screen sends the total it showed, and the database refuses with "the bills changed" so the page reloads. | ✅ Fixed | pgTAP |
| C8 | **Low.** "Still due" on the receipt left out ticked bills that got nothing. | `receipts-data.ts` | It now shows everything the student owes today, on all bills. | ✅ Fixed | e2e |
| C9 | **Low.** The ledger dated a late fine on the bill's date, so balances of earlier days changed afterwards. | `fee-dues.ts` | A fine is its own entry, dated the day it was frozen. | ✅ Fixed | — |
| C10 | **Low.** "Top dues" on the accountant's home left out late fines and counted every session. | `fee-reports.ts` | Current session, with today's late fines, as the dues report. | ✅ Fixed | — |
| C11 | **Low.** The income report replaced a "to" date earlier than "from" with today. | `reports/load.ts` | Dates given the wrong way round are swapped. | ✅ Fixed | — |
| C12 | **Medium.** The generator accepted a month outside the session, another session's key, an exam of another session, and `session:01` next to `session:1` (double billing). | `create_invoices` | Each is refused. | ✅ Fixed | pgTAP |
| C13 | **Medium.** Catching up a past month billed students admitted after that month. | generator (TS and SQL) | Students admitted after the month's end are skipped. | ✅ Fixed | pgTAP |
| C14 | **Low–medium.** A one-time fee could be billed once as a session fee and again as an exam fee. | `create_invoices` | A one-time head billed for the session under one kind of period is not billed under the other. | ✅ Fixed | pgTAP |
| C15 | **Low.** An amount of 0 made empty "paid" invoices. | `fees.ts`, `create_invoices` | Skipped. | ✅ Fixed | unit, pgTAP |
| C16 | **Medium.** A waiver approved after the bills were made could not be applied (bills cannot be changed). | generator preview | The preview warns when waivers of these students are still waiting for an admin. Re-pricing bills is left to a later "adjust bill" function. | ✅ Warned / 📝 Later | — |
| C17 | **Low.** Every generator error showed "due date has passed". | `generate-actions.ts` | Separate codes: due date, and "fees or period changed". | ✅ Fixed | pgTAP |
| C18 | **Low.** Changing the session kept the old exam selected. | `generate-form.tsx` | Cleared on change. | ✅ Fixed | — |
| C19 | **Low.** The month filters dropped Bangla digits ("২০২৬-১০") without a message. | invoices page, dues report | Converted first. The Bangla hint now uses Bangla digits. | ✅ Fixed | — |
| C20 | **Low.** Late fine settings above the database limit gave a generic error. | `validation/fees.ts` | Limit checked with a clear message. | ✅ Fixed | unit |
| C21 | **Low.** Waivers can only be made for the current session. | waivers page | 📝 Later (session picker). | 📝 Later | — |
| U1 | **High (shows wrong money).** With a month filter, the invoice list dropped the frozen fine item, then added a live fine on top of a total that already included it. | `invoices-data.ts` | The filter uses a separate embed, so all items are kept. | ✅ Fixed | — |

## Performance

| # | Finding | Status |
|---|---|---|
| P1 | The invoice list loads a whole session (no paging) and filters by class in JavaScript. | 📝 Later: page by 50 and filter in SQL. Fine for one school today, about 12,000 bills a year. |
| P2 | The dues report loads all open bills with enrolments and guardians, then filters in JavaScript. | 📝 Later: a `student_dues` SQL view. |
| P3 | The accountant's home reads payments since last month and all open bills on each load. | Partly: limited to the current session. 📝 Later: one SQL summary. |
| P4 | No index for bills by session and status. | ✅ Fixed: `invoices_session_idx`, `invoices_open_idx`. |
| P5 | Period names and fee settings are fetched more than once per request. | 📝 Later (`cache()`). |
| P6 | A few requests run one after another. | Partly: the receipt reads in parallel. 📝 Later. |
| P7 | `revalidatePath` of the whole dashboard after each payment. | 📝 Later: the pages are dynamic, so it is harmless. |

## Maintainability

| # | Finding | Status |
|---|---|---|
| M1 | The live-fine rule is repeated in several TypeScript files and SQL functions. U1 came from this. | 📝 Later: one `liveFine()` and an `invoice_dues` view. The SQL is now in one payment function. |
| M2 | `as never` and `as unknown as` casts on embedded relations. | 📝 Later (`.returns<T>()`). |
| M3 | The PDF money formatter and the QR payload were duplicated. The QR showed "1200.5". | ✅ Fixed: `receipt-text.ts` (unit tested); the currency word comes from the dictionary. |
| M4 | SQL wrote English text into the data ("Online (sandbox)", "Paid online"). | ✅ Fixed: stored empty; shown from the dictionary. |
| M5 | Small duplications (select class, section label, `pick()`) and dead code. | 📝 Later. |
| M6 | The accountant's home rendered an empty list. | ✅ Fixed. |

## UX / i18n

| # | Finding | Status |
|---|---|---|
| U2 | Bangla pages showed English-only receiver names and online labels. | ✅ Fixed: the receiver's name is stored in both languages; online payments say "Online payment (gateway)" from the dictionary. |
| U3 | Confirmations use `window.confirm`. | 📝 Later (a styled dialog). |
| U4 | Month filters are free text (see C19). | ✅ Digits fixed; 📝 a month picker later. |
| U5 | The payment status page never updated while waiting for the gateway. | ✅ Fixed: it checks again every 3 s for a minute, with a "Check again" button. |
| U6 | The receipt PDF cannot show Bangla text typed by users (a cancel reason, for example). | 📝 Later (a Bangla font for PDFs; the web receipt is bilingual). |
| U7 | Bangla Excel files show student IDs and phones with Bangla digits. | 📝 Later (a "code" cell kind). |
| U8 | Receipt and invoice numbers stay in ASCII digits on Bangla pages. | 📝 Later (decide one rule). |
| U9 | "Classes" (plural) labelled one class on receipts and invoices. | ✅ Fixed. |
| U10 | Top dues disagreed with the dues report. | ✅ Fixed (C10). |
| U11, U12 | Small form and alignment issues. | 📝 Later. |
| U13 | Students cannot pay online. | ✅ Intended (S4). |

## Results after the fixes

- `lint` ✅, `typecheck` ✅.
- `test` ✅ 516.
- `db:test` ✅ 32 files / 504 tests.
- `db lint` ✅; types up to date ✅.
- `build` ✅.
- `test:e2e` ✅ 245 passed, 5 skipped by design. The generator test now also checks the new "waiting waivers" warning.
