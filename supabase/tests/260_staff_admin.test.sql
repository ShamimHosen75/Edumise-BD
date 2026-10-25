-- Step 3.2: staff management rights.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(9);

-- A teacher reads their own private details only, and cannot manage staff.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is((select count(*)::int from public.staff_private), 1, 'a teacher sees only their own private details');
select is((select nid from public.staff_private), '1990000000003', 'and they are their own');
select throws_ok($$ insert into public.staff (full_name_en, designation_id) select 'x', id from public.designations limit 1 $$,
  '42501', null, 'a teacher cannot add staff');
select is(pg_temp.affected($$ update public.staff set full_name_en = 'x' $$), 0, 'a teacher cannot edit staff');
select throws_ok($$ insert into public.teacher_assignments (session_id, staff_id, section_id, subject_id)
  select (select id from public.academic_sessions limit 1), (select id from public.staff limit 1),
         (select id from public.sections limit 1), (select id from public.subjects limit 1) $$,
  '42501', null, 'a teacher cannot assign subjects');
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-4000-a000-000000000003' $$,
  '42501', null, 'a teacher cannot raise their own role');

-- An admin manages staff, but cannot turn a super admin's login off.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select is((select count(*)::int from public.staff_private), (select count(*)::int from public.staff), 'an admin reads every private record');
select lives_ok($$ update public.staff set sort_order = sort_order where full_name_en = 'Kamal Hossain' $$, 'an admin edits staff');
select throws_ok($$ update public.profiles set is_active = false where id = '00000000-0000-4000-a000-000000000001' $$,
  '42501', null, 'an admin cannot switch off a super admin');

select * from finish();
rollback;
