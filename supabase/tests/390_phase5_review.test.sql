-- Phase 5 code review: regression tests (docs/code-review-phase-5.md).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(26);

create temporary table ids as select
  (select id from public.academic_sessions where is_current) as session,
  (select id from public.students where full_name_en = 'Rahim Ahmed') as rahim,
  (select id from public.students where full_name_en = 'Karim Ahmed') as karim,
  (select id from public.students where full_name_en = 'Tanvir Hasan') as tanvir,
  (select id from public.fee_heads where code = 'TUITION') as tuition,
  (select id from public.fee_heads where code = 'SESSION') as sess,
  (select id from public.fee_heads where code = 'LAB') as lab,
  (select id from public.exams where name_en = 'Annual Exam 2026') as exam,
  (select id from public.invoices where invoice_no = 'INV-2026-00003') as inv3;
grant select on ids to authenticated, service_role;
create temporary table intent (id uuid, amount bigint);
grant all on intent to authenticated, service_role;
create function pg_temp.plan(student bigint, head bigint) returns jsonb language sql as
  $$ select jsonb_build_array(jsonb_build_object('student_id', student, 'items',
       jsonb_build_array(jsonb_build_object('fee_head_id', head, 'gross', 1, 'waiver', 1)))) $$;

-- Test data (as the database owner): a LAB amount of 0 for Rahim's class, Karim admitted
-- in December, and a second overdue bill for Tanvir.
insert into public.fee_structures (session_id, class_id, group_id, fee_head_id, amount)
select session, (select se.class_id from public.enrollments en join public.sections se on se.id = en.section_id
  where en.student_id = rahim and en.session_id = session), null, lab, 0 from ids
on conflict (session_id, class_id, group_id, fee_head_id) do update set amount = 0;
update public.students set admitted_on = '2026-12-15' where id = (select karim from ids);
insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, total)
select 'INV-T-390', tanvir, session, '2026-10-20', '2026-10-25', 50000 from ids;
insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross)
select (select id from public.invoices where invoice_no = 'INV-T-390'), tanvir, tuition, '2026-09', 50000 from ids;
update public.fee_settings set late_fine_per_day = 1000, late_fine_cap = 10000, grace_days = 0;

set local role authenticated;
-- S1: invoices are not written directly -------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.invoice_items set waiver = gross $$), 0,
  'the accountant cannot waive an item by editing it');
select is(pg_temp.affected($$ update public.invoices set total = paid, status = 'paid' $$), 0,
  'nor mark a bill paid by editing it');
select throws_ok($$ insert into public.invoices (invoice_no, student_id, session_id, due_on, status, total, paid)
  values ('INV-X', 1, 1, '2099-01-01', 'paid', 100, 100) $$, '42501', null, 'nor add a "paid" bill');
select is(pg_temp.affected($$ delete from public.invoices where status = 'unpaid' $$), 0, 'nor delete a bill');
select throws_ok($$ select app.next_invoice_no(2026) $$, '42501', null, 'invoice numbers are not taken by hand');

-- S2, C2, C4, C5, C6: the generator works out the amounts --------------------------------
select is(public.create_invoices((select session from ids), '2026-12', '2099-12-31',
  pg_temp.plan((select rahim from ids), (select tuition from ids))),
  '{"created": 1, "skipped": 0}'::jsonb, 'December tuition for Rahim');
select results_eq($$ select ii.gross, ii.waiver from public.invoice_items ii
  where ii.student_id = (select rahim from ids) and ii.period_key = '2026-12' $$,
  $$ values (60000::bigint, 30000::bigint) $$,
  'the class amount and his approved half waiver are used, not the amounts sent');
select throws_ok($$ select public.create_invoices((select session from ids), '2027-05', '2099-12-31',
  pg_temp.plan((select rahim from ids), (select tuition from ids))) $$, '22023', null,
  'a month outside the session is refused');
select throws_ok($$ select public.create_invoices((select session from ids), 'session:0' || (select session from ids),
  '2099-12-31', pg_temp.plan((select rahim from ids), (select sess from ids))) $$, '22023', null,
  'a period key written another way is refused');
select throws_ok($$ select public.create_invoices((select session from ids), 'exam:999999', '2099-12-31',
  pg_temp.plan((select rahim from ids), (select sess from ids))) $$, '22023', null,
  'an exam of no session is refused');
select is(public.create_invoices((select session from ids), 'session:' || (select session from ids), '2099-12-31',
  pg_temp.plan((select rahim from ids), (select sess from ids))),
  '{"created": 1, "skipped": 0}'::jsonb, 'the session fee is billed once');
select is(public.create_invoices((select session from ids), 'exam:' || (select exam from ids), '2099-12-31',
  pg_temp.plan((select rahim from ids), (select sess from ids))),
  '{"created": 0, "skipped": 1}'::jsonb, 'and not again as an exam fee');
select is(public.create_invoices((select session from ids), 'session:' || (select session from ids), '2099-12-31',
  pg_temp.plan((select rahim from ids), (select lab from ids))),
  '{"created": 0, "skipped": 1}'::jsonb, 'an amount of 0 makes no "paid" bill');
select is(public.create_invoices((select session from ids), '2026-11', '2099-12-31',
  pg_temp.plan((select karim from ids), (select tuition from ids))),
  '{"created": 0, "skipped": 1}'::jsonb, 'a student admitted in December is not billed for November');

-- C5, C7: the late fine is frozen only on bills the money reaches -------------------------
select throws_ok($$ select public.record_payment((select tanvir from ids),
  array(select ii.id from public.invoice_items ii where ii.student_id = (select tanvir from ids) and not ii.is_fine),
  10000, 'cash', null, '', 1) $$, '22023', null, 'the screen''s total no longer matching is refused');
select lives_ok($$ select public.record_payment((select tanvir from ids),
  array(select ii.id from public.invoice_items ii where ii.student_id = (select tanvir from ids) and not ii.is_fine),
  10000, 'cash', null, '') $$, 'Tk 100 for both of Tanvir''s overdue bills');
select is((select count(*)::int from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id
  where i.invoice_no = 'INV-T-390' and ii.is_fine), 0,
  'the later bill, which got nothing, keeps a live fine (not frozen)');
select is((select count(*)::int from public.invoice_items where invoice_id = (select inv3 from ids) and is_fine), 1,
  'the older bill''s fine is frozen and paid');

-- S4, C1, C2, C4: online payments ----------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
update public.fee_settings set online_payment_enabled = true, payment_provider = 'sandbox';
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select throws_ok($$ select public.create_payment_intent((select rahim from ids)) $$, '42501', null,
  'a student does not pay online (guardians do)');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
insert into intent select (r ->> 'id')::uuid, (r ->> 'amount')::bigint
  from (select public.create_payment_intent((select rahim from ids)) as r) x;

reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'abcd1234', 1), 'mismatch',
  'a wrong amount closes the intent');
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'abcd1234', (select amount from intent)),
  'mismatch', 'and the right amount later still records nothing (a closed intent is final)');
select is((select count(*)::int from public.payments where gateway_txn_id = 'abcd1234'), 0, 'nothing was recorded');

-- A new intent, started yesterday: the fine is the one shown then.
reset role;
insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, total)
select 'INV-T-390B', rahim, session, '2026-09-01', '2026-09-05', 40000 from ids;
insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross)
select (select id from public.invoices where invoice_no = 'INV-T-390B'), rahim, tuition, '2026-08', 40000 from ids;
update public.fee_settings set late_fine_cap = 0;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
delete from intent;
insert into intent select (r ->> 'id')::uuid, (r ->> 'amount')::bigint
  from (select public.create_payment_intent((select rahim from ids)) as r) x;
reset role;
update public.payment_intents set created_at = created_at - interval '1 day', amount = amount - 1000
where id = (select id from intent);
update intent set amount = amount - 1000;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'ABCD1234', (select amount from intent)),
  'recorded', 'a payment confirmed the next day is worked out for the day it was started');
select results_eq($$ select status::text, total = paid from public.invoices where invoice_no = 'INV-T-390B' $$,
  $$ values ('paid', true) $$, 'so the bill is paid in full, not left Tk 10 short');
select results_eq($$ select gateway, gateway_txn_id, txn_id ~ '^GW-[0-9A-F]{32}$' from public.payments
  where id = (select payment_id from public.payment_intents where id = (select id from intent)) $$,
  $$ values ('sandbox', 'ABCD1234', true) $$,
  'the gateway''s ID is kept as sent; "abcd1234" and "ABCD1234" do not clash');
select is((select collected_by_name from public.payments
  where id = (select payment_id from public.payment_intents where id = (select id from intent))), '',
  'no English text is stored as the receiver of an online payment');

select * from finish();
rollback;
