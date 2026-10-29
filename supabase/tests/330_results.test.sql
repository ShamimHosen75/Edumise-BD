-- Step 4.3: results, the public mark-sheet lookup, the publish gate and board results.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create temporary table ids as select
  (select id from public.exams where name_en = 'Half Yearly Exam 2026') as exam,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A') as s6a,
  (select st.id from public.students st where st.full_name_en = 'Rahim Ahmed') as rahim,
  (select st.id from public.students st where st.full_name_en = 'Karim Ahmed') as karim;
grant select on ids to authenticated, anon, service_role;

-- Visitors ---------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.results), 0, 'visitors cannot read results');
select ok(not has_function_privilege('anon', 'public.lookup_result(bigint, bigint, integer, bigint)', 'execute'),
  'visitors cannot call the lookup directly (the server rate-limits it)');
select ok(not has_function_privilege('authenticated', 'public.lookup_result(bigint, bigint, integer, bigint)', 'execute'),
  'logged-in users cannot call the lookup directly either');
select is((select count(*)::int from public.board_results), 7, 'board results are public');

-- The server's lookup ------------------------------------------------------------
reset role;
set local role service_role;
select is(public.lookup_result((select exam from ids), (select s6a from ids), 1) ->> 'name_en', 'Rahim Ahmed',
  'one mark sheet by section and roll');
select ok(not (public.lookup_result((select exam from ids), (select s6a from ids), 1)
  ?| array['student_code', 'birth_date', 'photo_path', 'student_id', 'guardian']),
  'the mark sheet has no student ID, birth date, photo or family details');
select is(public.lookup_result((select exam from ids), (select s6a from ids), 99), null, 'unknown roll: nothing');
select is(public.lookup_result((select exam from ids), (select s6a from ids), 1,
  (select id from public.groups where code = 'science')), null, 'a group that does not match: nothing');

-- Who reads results -----------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select array_agg(student_id) from public.results), array[(select rahim from ids)],
  'a student sees only their own result');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select is((select count(*)::int from public.results where student_id not in ((select rahim from ids), (select karim from ids))), 0,
  'a guardian sees only their children');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.results), 10, 'a teacher sees results of their sections (6A and 6B)');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select is((select count(*)::int from public.results), 0, 'the accountant sees no results');

-- Processing --------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.save_exam_results((select exam from ids), '[]') $$, '42501', null,
  'a teacher cannot process results');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select throws_ok($$ select public.save_exam_results((select exam from ids), '[]') $$, '22023', null,
  'results are processed only while the exam is in review');
select throws_ok($$ insert into public.results (exam_id, student_id, section_id, roll, total, full_total, gpa,
  gpa_without_fourth, grade, passed, section_position, class_position, subjects)
  values ((select exam from ids), (select rahim from ids), (select s6a from ids), 1, 0, 0, 0, 0, 'F', false, 1, 1, '[]') $$,
  '42501', null, 'nobody writes results directly, not even admins');

update public.exams set status = 'review' where id = (select exam from ids);
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select count(*)::int from public.results), 0, 'once the exam is back in review the family sees nothing');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is(public.save_exam_results((select exam from ids), jsonb_build_array(jsonb_build_object(
  'student_id', (select rahim from ids), 'total', 500, 'full_total', 550, 'gpa', 5, 'gpa_without_fourth', 5,
  'grade', 'A+', 'passed', true, 'failed_count', 0, 'section_position', 1, 'class_position', 1,
  'attendance_percent', 96.5, 'subjects', '[]'::jsonb))), 1, 'an admin processes results for the exam');
select results_eq($$ select section_id, roll, count(*) over () from public.results where exam_id = (select exam from ids) $$,
  $$ values ((select s6a from ids), 1::smallint, 1::bigint) $$,
  'processing replaces the old rows; section and roll come from the enrolment');
select throws_ok($$ select public.save_exam_results((select exam from ids), jsonb_build_array(jsonb_build_object(
  'student_id', 999999, 'total', 0, 'full_total', 0, 'gpa', 0, 'gpa_without_fourth', 0,
  'grade', 'F', 'passed', false, 'failed_count', 0, 'section_position', 1, 'class_position', 1,
  'attendance_percent', null, 'subjects', '[]'::jsonb))) $$, '22023', null,
  'a student who does not sit this exam is refused');

-- Publishing needs current results ---------------------------------------------------
update public.exams set results_processed_at = null where id = (select exam from ids);
select throws_ok($$ update public.exams set status = 'published' where id = (select exam from ids) $$, '23514', null,
  'an exam cannot be published before its results are processed');
update public.exams set results_processed_at = now() - interval '1 minute' where id = (select exam from ids);
update public.marks set cq = cq where exam_subject_id in (select id from public.exam_subjects where exam_id = (select exam from ids))
  and student_id = (select rahim from ids);
select throws_ok($$ update public.exams set status = 'published' where id = (select exam from ids) $$, '23514', null,
  'marks changed after processing: process again first');
update public.exams set results_processed_at = now() + interval '1 minute' where id = (select exam from ids);
select lives_ok($$ update public.exams set status = 'published' where id = (select exam from ids) $$,
  'with current results the exam is published');

-- Board results ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select throws_ok($$ insert into public.board_results (exam, year, examinees, passed, gpa5) values ('ssc', 2018, 100, 90, 10) $$,
  '42501', null, 'teachers cannot enter board results');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select throws_ok($$ insert into public.board_results (exam, year, examinees, passed, gpa5) values ('ssc', 2018, 100, 101, 10) $$,
  '23514', null, 'passed cannot be more than examinees');

select * from finish();
rollback;
