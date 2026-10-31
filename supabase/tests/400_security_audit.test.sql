-- Step 6.2 security audit: regression tests (docs/security-report.md).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(22);

-- D6: catalogue checks ----------------------------------------------------------------
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""')),
  0, 'every security definer function (public and app) has search_path set to empty');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  0, 'every public view runs with the caller''s rights (security_invoker)');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('public_stats', 'is_bd_phone', 'class_allows_group')
     and p.prorettype <> 'trigger'::regtype),
  null, 'visitors can run only public_stats and two pure checks (plus trigger functions)');
select ok(
  not has_table_privilege('anon', 'public.students', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.payments', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.invoices', 'TRIGGER'),
  'D5: the API roles cannot TRUNCATE (which ignores RLS) or add triggers');

-- D1: switched-off family logins reach nothing --------------------------------------------
update public.profiles set is_active = false
where id in ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000006');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select is((select count(*)::int from public.students), 0, 'D1: a switched-off guardian sees no students');
select is((select count(*)::int from public.guardians where profile_id <> auth.uid()), 0,
  'nor anyone else''s guardian record (only their own)');
select is((select count(*)::int from public.invoices), 0, 'nor invoices');
select is((select count(*)::int from public.payments), 0, 'nor payments');
select is((select count(*)::int from public.attendance), 0, 'nor attendance');
select is((select count(*)::int from public.marks), 0, 'nor marks');
select is((select count(*)::int from public.results), 0, 'nor results');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select count(*)::int from public.students), 0, 'a switched-off student sees no student record');
select is((select count(*)::int from public.invoices), 0, 'nor invoices');
select is((select count(*)::int from public.attendance), 0, 'nor attendance');
reset role;
set local request.jwt.claims to '{}';
update public.profiles set is_active = true
where id in ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000006');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select ok((select count(*) from public.invoices) > 0, 'switched on again, the guardian sees the bills');

-- D3: names are changed by an admin only ----------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select throws_ok($$ update public.profiles set full_name_en = 'Principal (Head Teacher)'
  where id = '00000000-0000-4000-a000-000000000004' $$, '42501', null,
  'D3: the accountant cannot rename themselves (receipts print this name)');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select throws_ok($$ update public.profiles set full_name_bn = 'প্রধান শিক্ষক'
  where id = '00000000-0000-4000-a000-000000000005' $$, '42501', null, 'nor can a student');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.profiles set full_name_en = full_name_en || ''
  where id = '00000000-0000-4000-a000-000000000004' $$), 1, 'an admin can');

-- D2: a teacher's view of a section is limited to this session ------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select ok((select count(*) from public.attendance) > 0, 'this session, the teacher sees their sections'' attendance');
reset role;
set local request.jwt.claims to '{}';
update public.academic_sessions set is_current = false;
insert into public.academic_sessions (name, starts_on, ends_on, is_current)
values ('2099', '2099-01-01', '2099-12-31', true);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.attendance), 0,
  'D2: in a new session, earlier years'' attendance of the same sections is hidden');
select is((select count(*)::int from public.results), 0, 'and so are earlier years'' results');
select is((select count(*)::int from public.students), 0, 'as students already were');

select * from finish();
rollback;
