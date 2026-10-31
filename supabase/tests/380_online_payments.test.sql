-- Step 5.3: online payment intents, the admin-only switch and the webhook functions.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(24);

create temporary table ids as select
  (select id from public.students where full_name_en = 'Rahim Ahmed') as rahim,
  (select id from public.students where full_name_en = 'Tanvir Hasan') as tanvir;
grant select on ids to authenticated, service_role;
-- Rahim (guardian@sunrise.test's child) owes Tk 500 for November, due in the future.
insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, total)
select 'INV-T-380', rahim, (select id from public.academic_sessions where is_current), app.dhaka_today(), '2099-12-31', 50000 from ids;
insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross)
select (select id from public.invoices where invoice_no = 'INV-T-380'), rahim,
  (select id from public.fee_heads where code = 'TUITION'), '2099-11', 50000 from ids;
create temporary table intent (id uuid, amount bigint);
grant all on intent to authenticated, service_role;

set local role authenticated;
-- The switch is the office's -------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select throws_ok($$ update public.fee_settings set online_payment_enabled = true $$,
  '42501', null, 'the accountant cannot switch online payment on');
select is(pg_temp.affected($$ update public.fee_settings set grace_days = 2 $$), 1,
  'but still changes the late fine');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select throws_ok($$ select public.create_payment_intent((select rahim from ids)) $$,
  '55000', null, 'no Pay now while online payment is off');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select lives_ok($$ update public.fee_settings set online_payment_enabled = true, payment_provider = 'sandbox' $$,
  'an admin switches it on with the sandbox gateway');

-- Intents ---------------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select throws_ok($$ select public.create_payment_intent((select tanvir from ids)) $$,
  '42501', null, 'a guardian cannot pay for another child');
insert into intent select (r ->> 'id')::uuid, (r ->> 'amount')::bigint
  from (select public.create_payment_intent((select rahim from ids)) as r) x;
select is((select amount from intent), 50000::bigint, 'the intent is for everything owed');
select is((select count(*)::int from public.payment_intents), 1, 'the guardian sees their intent');
select throws_ok($$ insert into public.payment_intents (student_id, item_ids, amount, provider)
  values (1, '{1}', 1, 'sandbox') $$, '42501', null, 'nobody writes intents directly');
select throws_ok($$ select public.complete_payment_intent((select id from intent), 'sandbox', 'SBX-1', 50000) $$,
  '42501', null, 'a signed-in user cannot complete an intent');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.payment_intents), 0, 'teachers see no intents');

-- The webhook (service role) ---------------------------------------------------------------
reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select throws_ok($$ select public.complete_payment_intent((select id from intent), 'bkash', 'SBX-1', 50000) $$,
  '22023', null, 'another provider cannot complete it');
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'SBX-1', 49999), 'mismatch',
  'a wrong amount is refused');
select results_eq($$ select status, failure_reason from public.payment_intents where id = (select id from intent) $$,
  $$ values ('failed', 'amount_mismatch') $$, 'and the intent is marked failed');
select is((select paid from public.invoices where invoice_no = 'INV-T-380'), 0::bigint, 'nothing was recorded');

-- A new intent, paid once even if the webhook comes twice.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
delete from intent;
insert into intent select (r ->> 'id')::uuid, (r ->> 'amount')::bigint
  from (select public.create_payment_intent((select rahim from ids)) as r) x;
reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'sbx-7f3a', 50000), 'recorded',
  'the gateway''s webhook records the payment');
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'sbx-7f3a', 50000), 'duplicate',
  'the same webhook again records nothing');
select throws_ok($$ select public.complete_payment_intent((select id from intent), 'sandbox', 'sbx-other', 50000) $$,
  '23505', null, 'another transaction cannot pay it again');
select results_eq($$ select i.status::text, i.paid, p.method::text, p.gateway_txn_id, p.collected_by is null
  from public.invoices i, public.payments p
  where i.invoice_no = 'INV-T-380' and p.id = (select payment_id from public.payment_intents where id = (select id from intent)) $$,
  $$ values ('paid', 50000::bigint, 'online', 'sbx-7f3a', true) $$,
  'the invoice is paid; the receipt says online with the gateway''s ID');
select is((select count(*)::int from public.payments p join public.payment_allocations a on a.payment_id = p.id
  join public.invoice_items ii on ii.id = a.invoice_item_id join public.invoices i on i.id = ii.invoice_id
  where i.invoice_no = 'INV-T-380'), 1, 'exactly one payment');
select lives_ok($$ select public.fail_payment_intent((select id from intent), 'sandbox', 'late failure') $$,
  'a late "failed" message is harmless');
select is((select status from public.payment_intents where id = (select id from intent)), 'paid', 'the intent stays paid');

-- An intent whose bills were paid at the office meanwhile cannot be recorded.
reset role;
insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, total)
select 'INV-T-380B', rahim, (select id from public.academic_sessions where is_current), app.dhaka_today(), '2099-12-31', 10000 from ids;
insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross)
select (select id from public.invoices where invoice_no = 'INV-T-380B'), rahim,
  (select id from public.fee_heads where code = 'TUITION'), '2099-12', 10000 from ids;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
delete from intent;
insert into intent select (r ->> 'id')::uuid, (r ->> 'amount')::bigint
  from (select public.create_payment_intent((select rahim from ids)) as r) x;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select public.record_payment((select rahim from ids),
  array[(select ii.id from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id where i.invoice_no = 'INV-T-380B')],
  10000, 'cash', null, 'paid at the office');
reset role;
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(public.complete_payment_intent((select id from intent), 'sandbox', 'SBX-LATE1', 10000), 'unrecordable',
  'money for bills already paid at the office is not recorded twice');
select results_eq($$ select status, failure_reason, provider_txn_id from public.payment_intents where id = (select id from intent) $$,
  $$ values ('failed', 'cannot_record', 'SBX-LATE1') $$, 'the intent keeps the gateway ID for a refund');

-- The office still collects as before, but not as "online".
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select throws_ok($$ select public.record_payment((select tanvir from ids),
  array[(select ii.id from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id where i.invoice_no = 'INV-2026-00003')],
  100, 'online', 'X-1234', '') $$, '22023', null, 'the office cannot record an "online" payment');

select * from finish();
rollback;
