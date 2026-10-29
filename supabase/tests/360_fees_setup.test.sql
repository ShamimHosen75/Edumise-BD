-- Step 5.1: fee settings, waiver approval, invoice generator and structure copy.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(18);

create temporary table ids as select
  (select id from public.academic_sessions where is_current) as session,
  (select id from public.fee_heads where code = 'TUITION') as tuition,
  (select id from public.fee_heads where code = 'SPORTS') as sports,
  (select id from public.students where full_name_en = 'Ayesha Siddika') as ayesha,
  (select id from public.students where full_name_en = 'Tanvir Hasan') as tanvir;
grant select on ids to authenticated;

set local role authenticated;
-- Fee settings -------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select late_fine_per_day from public.fee_settings), 1000::bigint, 'families can read the late-fine rule');
select is(pg_temp.affected($$ update public.fee_settings set late_fine_per_day = 0 $$), 0, 'students cannot change it');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.fee_settings set late_fine_per_day = 0 $$), 0, 'teachers cannot change it');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.fee_settings set grace_days = 3 $$), 1, 'the accountant can');

-- Waivers: approval is the admin's --------------------------------------------------
select lives_ok($$ insert into public.fee_waivers (student_id, session_id, fee_head_id, kind, value, reason, approved_by, approved_at)
  select ayesha, session, tuition, 'fixed', 10000, 'Sibling', '00000000-0000-4000-a000-000000000002', now() from ids $$,
  'the accountant adds a waiver');
select ok((select approved_by is null and approved_at is null from public.fee_waivers
  where student_id = (select ayesha from ids) and reason = 'Sibling'),
  'it waits for an admin even if the accountant sends an approval');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
update public.fee_waivers set reason = 'Sibling discount' where student_id = (select ayesha from ids) and reason = 'Sibling';
select is((select approved_by::text from public.fee_waivers where student_id = (select ayesha from ids) and reason = 'Sibling discount'),
  '00000000-0000-4000-a000-000000000002', 'an admin approves it by saving it');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
update public.fee_waivers set value = 20000 where student_id = (select ayesha from ids) and reason = 'Sibling discount';
select ok((select approved_by is null from public.fee_waivers where student_id = (select ayesha from ids) and reason = 'Sibling discount'),
  'an accountant change needs approval again');

-- Invoice generator -------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.create_invoices((select session from ids), '2026-11', '2099-12-31', '[]') $$,
  '42501', null, 'teachers cannot make invoices');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
create temporary table plan as select jsonb_build_array(
  jsonb_build_object('student_id', ayesha, 'items', jsonb_build_array(
    jsonb_build_object('fee_head_id', tuition, 'gross', 60000, 'waiver', 10000))),
  jsonb_build_object('student_id', tanvir, 'items', jsonb_build_array(
    jsonb_build_object('fee_head_id', tuition, 'gross', 60000, 'waiver', 60000)))) as rows from ids;
grant select on plan to authenticated;
select is(public.create_invoices((select session from ids), '2026-11', '2099-12-31', (select rows from plan)),
  '{"created": 2, "skipped": 0}'::jsonb, 'the accountant makes November tuition invoices');
select results_eq($$ select i.total, i.status::text, i.invoice_no ~ '^INV-\d{4}-\d{6}$' from public.invoices i
  join public.invoice_items it on it.invoice_id = i.id where it.period_key = '2026-11' order by i.total $$,
  $$ values (0::bigint, 'paid', true), (50000::bigint, 'unpaid', true) $$,
  'totals are the net of the items; a fully waived invoice is paid; numbers are INV-YYYY-NNNNNN');
select is(public.create_invoices((select session from ids), '2026-11', '2099-12-31', (select rows from plan)),
  '{"created": 0, "skipped": 2}'::jsonb, 'running it again adds nothing');
select is((select count(*)::int from public.invoices i where not exists (select 1 from public.invoice_items it where it.invoice_id = i.id)),
  0, 'no empty invoices are left behind');
select throws_ok($$ select public.create_invoices((select session from ids), 'exam:1', '2099-12-31', (select rows from plan)) $$,
  '22023', null, 'a monthly head cannot be billed for a one-time period');
select throws_ok($$ select public.create_invoices((select session from ids), '2026-13', '2099-12-31', '[]') $$,
  '22023', null, 'a bad period is refused');
select throws_ok($$ select public.create_invoices((select session from ids), '2026-11', '2000-01-01', '[]') $$,
  '22023', null, 'a due date in the past is refused');

-- Copy the structure into a new session -------------------------------------------------
reset role;
insert into public.academic_sessions (name, starts_on, ends_on) values ('2099', '2099-01-01', '2099-12-31');
set local role authenticated;
select is(public.copy_fee_structure((select session from ids), (select id from public.academic_sessions where name = '2099')),
  (select count(*)::int from public.fee_structures where session_id = (select session from ids)),
  'the whole structure is copied to the new session');
select is(public.copy_fee_structure((select session from ids), (select id from public.academic_sessions where name = '2099')),
  0, 'copying again keeps what is there');

select * from finish();
rollback;
