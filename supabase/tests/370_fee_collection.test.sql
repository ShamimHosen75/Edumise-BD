-- Step 5.2: payments, receipts, the frozen late fine and cancellation.
-- Today (Dhaka) is after the seeded due date 2026-10-15; the seeded rule is Tk 10/day, at most Tk 100.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(28);

create temporary table ids as select
  (select id from public.students where full_name_en = 'Tanvir Hasan') as tanvir,
  (select id from public.students where full_name_en = 'Ayesha Siddika') as ayesha,
  (select id from public.invoices where invoice_no = 'INV-2026-00003') as inv3,
  (select ii.id from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id
   where i.invoice_no = 'INV-2026-00003') as item3,
  (select ii.id from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id
   where i.invoice_no = 'INV-2026-00002') as item2;
grant select on ids to authenticated;
update public.fee_settings set late_fine_per_day = 1000, late_fine_cap = 10000, grace_days = 0;

-- The fine rule matches lateFine() in src/lib/fees.ts.
select is(app.late_fine(1000, 10000, 0, '2026-10-15', '2026-10-20', 1), 5000::bigint, 'Tk 10 a day for 5 days');
select is(app.late_fine(1000, 10000, 0, '2026-10-15', '2026-11-30', 1), 10000::bigint, 'never above the cap');
select is(app.late_fine(1000, 0, 3, '2026-10-15', '2026-10-20', 1), 2000::bigint, 'grace days are free; no cap');
select is(app.late_fine(1000, 0, 0, '2026-10-15', '2026-10-15', 1), 0::bigint, 'nothing on the due date');
select is(app.late_fine(1000, 0, 0, '2026-10-15', '2026-10-20', 0), 0::bigint, 'nothing when nothing is owed');

set local role authenticated;
-- Who sees what ----------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.payments), 0, 'teachers see no payments');
select is((select count(*)::int from public.invoice_item_balances), 0, 'nor balances');
select throws_ok($$ select public.record_payment((select tanvir from ids), array[(select item3 from ids)], 100, 'cash', null, '') $$,
  '42501', null, 'teachers cannot collect fees');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select results_eq($$ select receipt_no from public.payments $$, $$ values ('RCP-2026-000001') $$,
  'a guardian sees only their children''s receipts');
select is((select count(*)::int from public.payment_allocations), 1, 'and only their allocations');
select throws_ok($$ insert into public.payments (receipt_no, student_id, amount, method, paid_on)
  values ('RCP-2026-999999', 1, 100, 'cash', '2026-10-29') $$, '42501', null, 'nobody writes payments directly');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select results_eq($$ select receipt_no from public.payments $$, $$ values ('RCP-2026-000001') $$,
  'a student sees their own receipt');

-- Collecting --------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select throws_ok($$ select public.record_payment((select tanvir from ids), array[(select item3 from ids)], 70001, 'cash', null, '') $$,
  '23514', null, 'more than the fees and the fine is refused');
select throws_ok($$ select public.record_payment((select tanvir from ids), array[(select item3 from ids)], 100, 'bkash', ' ', '') $$,
  '22023', null, 'bKash needs a transaction ID');
select throws_ok($$ select public.record_payment((select tanvir from ids), array[(select item2 from ids)], 100, 'cash', null, '') $$,
  '22023', null, 'another student''s item cannot be paid');
select is(public.record_payment((select tanvir from ids), array[(select item3 from ids)], 30000, 'cash', null, 'First part') ->> 'receipt_no',
  'RCP-2026-000003', 'a part payment gets the next receipt number');
select results_eq($$ select ii.gross, a.amount from public.payment_allocations a
  join public.invoice_items ii on ii.id = a.invoice_item_id join public.payments p on p.id = a.payment_id
  where p.receipt_no = 'RCP-2026-000003' order by ii.is_fine desc $$,
  $$ values (10000::bigint, 10000::bigint), (60000::bigint, 20000::bigint) $$,
  'the Tk 100 fine is frozen onto the invoice and paid first');
select results_eq($$ select total, paid, status::text from public.invoices where id = (select inv3 from ids) $$,
  $$ values (70000::bigint, 30000::bigint, 'partial') $$, 'the invoice is part paid');
select lives_ok($$ select public.record_payment((select tanvir from ids), array[(select item3 from ids)], 40000, 'bkash', 'tx-12345', '') $$,
  'the rest is paid (no second fine)');
select results_eq($$ select total, paid, status::text from public.invoices where id = (select inv3 from ids) $$,
  $$ values (70000::bigint, 70000::bigint, 'paid') $$, 'the invoice is paid');
select throws_ok($$ select public.record_payment((select ayesha from ids), array[(select item2 from ids)], 100, 'bkash', 'TX-12345', '') $$,
  '23505', null, 'a bKash transaction ID is recorded only once');
select throws_ok($$ update public.invoices set paid = 0, status = 'unpaid' where id = (select inv3 from ids) $$,
  '42501', null, 'what is paid cannot be edited by hand');
select throws_ok($$ insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, is_fine)
  select inv3, tanvir, (select id from public.fee_heads where code = 'LATE_FINE'), 'fine:' || inv3, 1, true from ids $$,
  '42501', null, 'nor a fine added by hand');
select throws_ok($$ update public.fee_heads set code = 'FINE' where code = 'LATE_FINE' $$,
  '42501', null, 'the late-fine head keeps its code');
select throws_ok($$ select public.create_invoices(i.session_id, 'session:' || i.session_id, '2099-12-31',
  jsonb_build_array(jsonb_build_object('student_id', i.student_id, 'items', jsonb_build_array(
    jsonb_build_object('fee_head_id', (select id from public.fee_heads where code = 'LATE_FINE'), 'gross', 100, 'waiver', 0)))))
  from public.invoices i where i.id = (select inv3 from ids) $$,
  '42501', null, 'and cannot be billed by the generator');

-- Cancelling ----------------------------------------------------------------------------
select throws_ok($$ select public.cancel_payment((select id from public.payments where receipt_no = 'RCP-2026-000004'), 'Wrong') $$,
  '42501', null, 'the accountant cannot cancel a payment');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select public.cancel_payment((select id from public.payments where receipt_no = 'RCP-2026-000004'), 'Wrong student');
select results_eq($$ select i.paid, i.status::text, p.cancel_reason from public.invoices i, public.payments p
  where i.id = (select inv3 from ids) and p.receipt_no = 'RCP-2026-000004' $$,
  $$ values (30000::bigint, 'partial', 'Wrong student') $$, 'an admin cancels it: the receipt keeps its number, the invoice owes again');
select throws_ok($$ select public.cancel_payment((select id from public.payments where receipt_no = 'RCP-2026-000004'), 'Again') $$,
  '22023', null, 'a payment is cancelled only once');

select * from finish();
rollback;
