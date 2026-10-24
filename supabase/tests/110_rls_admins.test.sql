-- Step 1.3: super_admin and admin.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(18);

-- super_admin -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';

select is(app.auth_role(), 'super_admin', 'super_admin is recognised');
select is((select count(*)::int from public.profiles), 6, 'super_admin reads all profiles');
select is((select count(*)::int from public.staff_private), 7, 'super_admin reads staff private fields');
select is(pg_temp.affected($$ update public.profiles set role = 'admin'
  where id = '00000000-0000-4000-a000-000000000002' $$), 1, 'super_admin can change an admin''s role');
select lives_ok($$ insert into public.rooms (name) values ('Room 999') $$, 'super_admin can add rooms');
-- negatives
select throws_ok($$ insert into public.school_settings (id, name_en) values (1, 'x') $$,
  '42501', null, 'super_admin cannot insert a second settings row through the API');
select is(pg_temp.affected($$ delete from public.school_settings $$), 0,
  'super_admin cannot delete school settings');
select throws_ok($$ select public.custom_access_token_hook('{}'::jsonb) $$,
  '42501', null, 'super_admin cannot call the token hook directly');

-- admin -----------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';

select is(app.auth_role(), 'admin', 'admin is recognised');
select is((select count(*)::int from public.students), 20, 'admin reads all students');
select is((select count(*)::int from public.notices), 6, 'admin reads all notices including drafts');
select is(pg_temp.affected($$ update public.school_settings set phone = '01700000009' $$), 1,
  'admin can edit school settings');
select lives_ok($$ insert into public.notices (slug, title_en) values ('admin-draft', 'Draft') $$,
  'admin can create notices');
select is(pg_temp.affected($$ update public.attendance set status = 'late'
  where id = (select min(id) from public.attendance) $$), 1, 'admin can correct attendance');
-- negatives
select throws_ok($$ update public.profiles set full_name_en = 'x'
  where id = '00000000-0000-4000-a000-000000000001' $$,
  '42501', 'Only a super admin can change a super admin', 'admin cannot edit a super_admin');
select throws_ok($$ update public.profiles set role = 'super_admin'
  where id = '00000000-0000-4000-a000-000000000003' $$,
  '42501', 'Only a super admin can change a super admin', 'admin cannot promote anyone to super_admin');
select is(pg_temp.affected($$ delete from public.profiles where id = '00000000-0000-4000-a000-000000000003' $$),
  0, 'admin cannot delete profiles');
select is(pg_temp.affected($$ delete from public.school_settings $$), 0, 'admin cannot delete school settings');

select * from finish();
rollback;
