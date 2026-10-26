-- Phase 3 code review regressions (docs/code-review-phase-3.md).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table ids as select
  (select id from public.academic_sessions where is_current) as session_id,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A') as s6a;
grant select on ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select throws_ok($$ select public.set_primary_guardian(1, 1) $$, '42501', null, 'a teacher cannot change main contacts');
select is((select count(*)::int from public.student_code_counters), 0, 'a teacher cannot read student ID counters');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';

-- F6: a deleted student's ID is not given again.
create temporary table first_add as
select * from public.add_student('{"full_name_en": "T Code 1", "gender": "male"}',
  (select session_id from ids), (select s6a from ids), null, null);
delete from public.students where id = (select student_id from first_add);
create temporary table second_add as
select * from public.add_student('{"full_name_en": "T Code 2", "gender": "male"}',
  (select session_id from ids), (select s6a from ids), null, null);
select isnt((select student_code from second_add), (select student_code from first_add),
  'student IDs are never reused');

-- S1 / F2: approval makes its own guardian records; a local guardian named like the father works.
reset role;
insert into public.admission_applications (
  tracking_no, session_id, class_id, student_name_en, birth_date, gender, birth_reg_no,
  father_name, mother_name, local_guardian_name, guardian_phone, present_address
) values (
  'ADM-2026-99951', (select session_id from ids), (select id from public.classes where level = 6),
  'T Review', '2014-03-15', 'female', '20143512345678951', 'Jamal Ahmed', 'T Mother',
  'jamal ahmed', '01810000006', 'Road 1'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
create temporary table approved as
select * from public.approve_admission(
  (select id from public.admission_applications where tracking_no = 'ADM-2026-99951'), (select s6a from ids));
select ok((select guardian_id from approved) is not null, 'a local guardian named like the father can be approved');
select isnt((select guardian_id from approved),
  (select id from public.guardians where profile_id = '00000000-0000-4000-a000-000000000006'),
  'an existing guardian with the same mobile and name is not reused (not joined to that family)');
select is((select relation from public.student_guardians where student_id = (select student_id from approved) and is_primary),
  'father', 'the father is the main contact');
select is((select count(*)::int from public.student_guardians where student_id = (select student_id from approved)),
  2, 'father and mother, no third record for the same person');

-- F13: one main contact per student, changed in one step.
select ok(public.set_primary_guardian((select student_id from approved),
  (select guardian_id from public.student_guardians where student_id = (select student_id from approved) and relation = 'mother')),
  'the main contact can be changed');
select is((select count(*)::int from public.student_guardians where student_id = (select student_id from approved) and is_primary),
  1, 'still exactly one main contact');
select is(public.set_primary_guardian((select student_id from approved), 999999), false,
  'a guardian not linked to the student cannot become the main contact');
select throws_ok($$ update public.student_guardians set is_primary = true
  where student_id = (select student_id from approved) $$, '23505', null, 'two main contacts are refused');

-- F4 / F11: promotion refuses missing sections and earlier sessions.
insert into public.academic_sessions (name, starts_on, ends_on) values ('2027', '2027-01-01', '2027-12-31'),
  ('2025', '2025-01-01', '2025-12-31');
delete from public.sections where class_id = (select id from public.classes where level = 7) and name_en = 'B';
select throws_ok($$ select public.promote_students(
  (select session_id from ids), (select id from public.academic_sessions where name = '2027'),
  (select id from public.classes where level = 6),
  (select jsonb_agg(jsonb_build_object('student_id', e.student_id, 'promote', true)) from public.enrollments e
   join public.sections s on s.id = e.section_id where e.session_id = (select session_id from ids)
   and s.class_id = (select id from public.classes where level = 6))) $$,
  '23503', null, 'promotion stops when a section is missing in the next class');
select throws_ok($$ select public.promote_students(
  (select session_id from ids), (select id from public.academic_sessions where name = '2025'),
  (select id from public.classes where level = 6), '[]') $$,
  '22023', null, 'promotion goes into a later session only');

select * from finish();
rollback;
