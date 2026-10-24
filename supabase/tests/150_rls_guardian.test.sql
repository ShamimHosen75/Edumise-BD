-- Step 1.3: guardian (Jamal Ahmed: Rahim in 6A and Karim in 9A).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(14);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';

-- Allowed
select is(app.auth_role(), 'guardian', 'guardian is recognised');
select results_eq($$ select full_name_en from public.students order by full_name_en $$,
  $$ values ('Karim Ahmed'), ('Rahim Ahmed') $$, 'guardian reads both linked children only');
select is(cardinality(app.guardian_student_ids()), 2, 'guardian_student_ids returns two children');
select is((select count(*)::int from public.enrollments), 2, 'guardian reads children''s enrolments');
select is((select count(*)::int from public.attendance), 5, 'guardian reads children''s attendance');
select is((select count(*)::int from public.marks), 6, 'guardian reads children''s published marks');
select is((select count(*)::int from public.invoices), 1, 'guardian reads children''s invoices');
select ok(exists (select 1 from public.notices where audience = 'class'), 'guardian sees a child''s class notice');

-- Forbidden
select is((select count(*)::int from public.profiles), 1, 'guardian reads only own profile');
select is((select count(*)::int from public.notices where audience = 'staff'), 0, 'guardian cannot see staff notices');
select throws_ok($$ insert into public.students (student_code, full_name_en, gender) values ('X2', 'x', 'male') $$,
  '42501', null, 'guardian cannot add students');
select is(pg_temp.affected($$ update public.attendance set status = 'present' $$), 0,
  'guardian cannot change attendance');
select is(pg_temp.affected($$ delete from public.invoices $$), 0, 'guardian cannot delete invoices');
select is((select count(*)::int from public.guardians where profile_id is distinct from auth.uid()), 0,
  'guardian cannot see other guardians');

select * from finish();
rollback;
