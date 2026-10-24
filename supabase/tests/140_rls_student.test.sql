-- Step 1.3: student (Rahim Ahmed, 6A roll 1).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;

-- A mark in the unpublished Annual exam, which the student must not see yet.
insert into public.marks (exam_subject_id, student_id, cq, mcq)
select es.id, st.id, 40, 20
from public.exam_subjects es join public.exams e on e.id = es.exam_id
join public.subjects s on s.id = es.subject_id, public.students st
where e.status = 'draft' and s.code = 'MATH' and st.full_name_en = 'Rahim Ahmed';

select plan(16);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';

-- Allowed
select is(app.auth_role(), 'student', 'student is recognised');
select results_eq($$ select full_name_en from public.students $$, $$ values ('Rahim Ahmed') $$,
  'student reads only own record');
select ok(app.my_student_id() = (select id from public.students where full_name_en = 'Rahim Ahmed'),
  'my_student_id matches');
select is((select count(*)::int from public.attendance), 5, 'student reads own attendance');
select is((select count(*)::int from public.marks), 6, 'student reads own marks of the published exam only');
select is((select count(*)::int from public.invoices), 1, 'student reads own invoice');
select is((select count(*)::int from public.guardians), 1, 'student reads own guardian');
select ok(exists (select 1 from public.notices where audience = 'class'), 'student sees own class notice');

-- Forbidden
select is((select count(*)::int from public.students where full_name_en <> 'Rahim Ahmed'), 0,
  'student cannot see other students');
select is((select count(*)::int from public.notices where audience = 'staff'), 0, 'student cannot see staff notices');
select is(pg_temp.affected($$ update public.marks set cq = cq $$), 0, 'student cannot change own marks');
select is(pg_temp.affected($$ update public.invoices set paid = total $$), 0, 'student cannot mark own invoice paid');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status)
  select e.student_id, e.section_id, '2026-10-24', 'present' from public.enrollments e $$,
  '42501', null, 'student cannot mark attendance');
select is((select count(*)::int from public.staff_private), 0, 'student cannot read staff private fields');
select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'student cannot change own role');
select is((select count(*)::int from public.teacher_assignments), 0, 'student cannot read teacher assignments');

select * from finish();
rollback;
