-- Step 3.4: student management (add, import, promotion, documents).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Document paths stay inside the student's folder.
select throws_ok($$ insert into public.student_documents (student_id, label, file_path, mime_type, file_size)
  select id, 'TC', 'students/1/../../x.pdf', 'application/pdf', 10 from public.students limit 1 $$,
  '23514', null, 'student document paths stay inside the student folder');

-- Teachers, students and guardians cannot read documents or call the office functions.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is((select count(*)::int from public.student_documents), 0, 'a teacher cannot read student documents');
select throws_ok($$ select public.import_students(1, '[]') $$, '42501', null, 'a teacher cannot import');
select throws_ok($$ select public.promote_students(1, 2, 1, '[]') $$, '42501', null, 'a teacher cannot promote');
select throws_ok($$ select * from public.add_student('{}', 1, 1, null, null) $$, '42501', null, 'a teacher cannot add students');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated", "app_role": "guardian"}';
select is((select count(*)::int from public.student_documents), 0, 'a guardian cannot read student documents');
select throws_ok($$ select app.next_student_code(6::smallint) $$, '42501', null, 'nobody calls the ID helper directly');

-- Admin: add one student with the next roll.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
create temporary table sec as
select s.id, c.level, s.name_en from public.sections s join public.classes c on c.id = s.class_id;
create temporary table added as
select * from public.add_student(
  '{"full_name_en": "T Added", "gender": "male", "status": "active", "birth_reg_no": "", "religion": ""}',
  (select id from public.academic_sessions where is_current),
  (select id from sec where level = 6 and name_en = 'A'), null, null);
select matches((select student_code from added), '^[0-9]{4}06[0-9]{4}$', 'added student gets a student ID');
select is((select roll from added), 7::smallint, 'added student gets the next roll (6A has 6)');
select is((select religion::text from public.students where id = (select student_id from added)), null,
  'empty choices are stored as null');
select throws_ok($$ select * from public.add_student('{"full_name_en": "T Dup", "gender": "male"}',
  (select id from public.academic_sessions where is_current), (select id from sec where level = 6 and name_en = 'A'), null, 7::smallint) $$,
  '23505', null, 'a roll cannot be used twice in a section');
select is((select count(*)::int from public.students where full_name_en = 'T Dup'), 0, 'a failed add saves nothing');

-- Import: all rows or none; guardians with the same mobile and name are reused.
select is(public.import_students((select id from public.academic_sessions where is_current), jsonb_build_array(
  jsonb_build_object('name_en', 'T Imp 1', 'gender', 'female', 'section_id', (select id from sec where level = 6 and name_en = 'B'),
    'roll', 20, 'guardian_name', 'T Parent', 'guardian_phone', '01799990011', 'relation', 'mother', 'birth_date', '2014-02-02'),
  jsonb_build_object('name_en', 'T Imp 2', 'gender', 'male', 'section_id', (select id from sec where level = 9 and name_en = 'A'),
    'roll', '', 'guardian_name', 't parent', 'guardian_phone', '01799990011', 'relation', 'father'))), 2,
  'import returns the number of students');
select is((select count(*)::int from public.guardians where phone = '01799990011'), 1, 'one guardian for both children');
select is((select count(*)::int from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id
  where g.phone = '01799990011' and sg.is_primary), 2, 'the guardian is the main contact of both');
select is((select e.roll from public.enrollments e join public.students s on s.id = e.student_id where s.full_name_en = 'T Imp 2'),
  7::smallint, 'an empty roll gets the next one');
select throws_ok($$ select public.import_students((select id from public.academic_sessions where is_current), jsonb_build_array(
  jsonb_build_object('name_en', 'T Imp 3', 'gender', 'male', 'section_id', (select id from sec where level = 6 and name_en = 'B'),
    'roll', 30, 'guardian_name', 'G', 'guardian_phone', '01799990012', 'relation', 'father'),
  jsonb_build_object('name_en', 'T Imp 4', 'gender', 'male', 'section_id', (select id from sec where level = 6 and name_en = 'B'),
    'roll', 30, 'guardian_name', 'G', 'guardian_phone', '01799990012', 'relation', 'father'))) $$,
  '23505', null, 'a clash stops the import');
select is((select count(*)::int from public.students where full_name_en in ('T Imp 3', 'T Imp 4')), 0,
  'nothing from a failed import is saved');

-- Promotion: Class 6 2026 -> 2027. Promoted go to Class 7 (same section), retained stay.
insert into public.academic_sessions (name, starts_on, ends_on) values ('2027', '2027-01-01', '2027-12-31');
create temporary table c6 as
select e.student_id, s.name_en as section, e.roll from public.enrollments e
join sec s on s.id = e.section_id
where e.session_id = (select id from public.academic_sessions where name = '2026') and s.level = 6;
select is(public.promote_students(
  (select id from public.academic_sessions where name = '2026'),
  (select id from public.academic_sessions where name = '2027'),
  (select id from public.classes where level = 6),
  (select jsonb_agg(jsonb_build_object('student_id', student_id, 'promote', not (section = 'A' and roll = 2))) from c6)),
  (select count(*)::int from c6), 'every student of the class gets a new enrolment');
select is((select string_agg(e.roll::text, ',' order by e.roll) from public.enrollments e join sec s on s.id = e.section_id
  where e.session_id = (select id from public.academic_sessions where name = '2027') and s.level = 7 and s.name_en = 'A'),
  '1,2,3,4,5,6', 'promoted 6A students are 7A with rolls in the old order');
select is((select s.level from public.enrollments e join sec s on s.id = e.section_id
  where e.session_id = (select id from public.academic_sessions where name = '2027')
    and e.student_id = (select student_id from c6 where section = 'A' and roll = 2)), 6::smallint,
  'a retained student stays in Class 6');
select throws_ok($$ select public.promote_students(
  (select id from public.academic_sessions where name = '2026'), (select id from public.academic_sessions where name = '2027'),
  (select id from public.classes where level = 6),
  (select jsonb_agg(jsonb_build_object('student_id', student_id, 'promote', true)) from c6)) $$,
  '23505', null, 'a class cannot be promoted twice into the same session');

select * from finish();
rollback;
