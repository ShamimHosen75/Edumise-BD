-- Step 1.2: demo data is complete and consistent.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select results_eq(
  $$ select p.role::text from public.profiles p order by p.role $$,
  $$ values ('super_admin'), ('admin'), ('teacher'), ('accountant'), ('student'), ('guardian') $$,
  'one demo login per role'
);
select is((select count(*)::int from auth.identities where provider = 'email'), 6, 'each demo login has an email identity');
select is((select count(*)::int from public.profiles where must_change_password), 0, 'demo logins do not need a password change');
select is((select count(*)::int from public.school_settings), 1, 'one school_settings row');
select is((select count(*)::int from public.academic_sessions where is_current), 1, 'one current session');
select is((select count(*)::int from public.classes), 5, 'Classes 6-10');
select is((select count(*)::int from public.sections), 10, 'two sections per class');
select is((select count(*)::int from public.enrollments), 20, '20 students enrolled');
select is(
  (select count(*)::int from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id
   where g.profile_id = '00000000-0000-4000-a000-000000000006'),
  2, 'the demo guardian has two children'
);
select ok(
  exists (select 1 from public.students where profile_id = '00000000-0000-4000-a000-000000000005'),
  'the demo student login is linked to a student'
);
select ok(
  exists (select 1 from public.teacher_assignments ta join public.staff s on s.id = ta.staff_id
          where s.profile_id = '00000000-0000-4000-a000-000000000003'),
  'the demo teacher has teaching assignments'
);
select results_eq(
  $$ select status::text, count(*)::int from public.exams group by status order by status $$,
  $$ values ('draft', 1), ('published', 1) $$,
  'one draft and one published exam'
);

select * from finish();
rollback;
