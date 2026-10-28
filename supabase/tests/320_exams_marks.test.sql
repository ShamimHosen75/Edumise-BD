-- Step 4.2: marks entry window, submit & lock per section, admin unlock.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(14);

update public.exams set status = 'marks_entry' where name_en = 'Annual Exam 2026';
create temporary table ids as select
  (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id
   join public.subjects s on s.id = es.subject_id where e.name_en = 'Annual Exam 2026' and s.code = 'MATH') as math,
  (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id
   join public.subjects s on s.id = es.subject_id where e.name_en = 'Annual Exam 2026' and s.code = 'BAN') as bangla,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A') as s6a,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'B') as s6b;
create temporary table pupils as
select e.student_id, s.name_en as section, e.roll from public.enrollments e
join public.sections s on s.id = e.section_id join public.classes c on c.id = s.class_id
where c.level = 6 and e.session_id = (select id from public.academic_sessions where is_current);
grant select on ids, pupils to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select lives_ok($$ insert into public.marks (exam_subject_id, student_id, cq, mcq)
  select (select math from ids), student_id, 50, 20 from pupils where section = 'A' and roll <= 5 $$,
  'a teacher enters marks for own subject while the exam takes marks');
select throws_ok($$ insert into public.marks (exam_subject_id, student_id, cq, mcq)
  select (select math from ids), student_id, 71, 0 from pupils where section = 'A' and roll = 6 $$,
  '23514', null, 'marks above full marks are refused');
select throws_ok($$ select public.submit_marks((select math from ids), (select s6a from ids)) $$,
  '23514', null, 'submit needs marks for every student');
select lives_ok($$ insert into public.marks (exam_subject_id, student_id, is_absent)
  select (select math from ids), student_id, true from pupils where section = 'A' and roll = 6 $$,
  'absent counts as entered');
select is(public.submit_marks((select math from ids), (select s6a from ids)), 6, 'submit & lock 6A Mathematics');
select is(pg_temp.affected($$ update public.marks set cq = 1 where exam_subject_id = (select math from ids) $$), 0,
  'after the lock the teacher cannot change 6A marks');
select lives_ok($$ insert into public.marks (exam_subject_id, student_id, cq, mcq)
  select (select math from ids), student_id, 40, 15 from pupils where section = 'B' and roll = 1 $$,
  'the lock is per section: 6B is still open');
select throws_ok($$ select public.submit_marks((select bangla from ids), (select s6a from ids)) $$,
  '42501', null, 'a teacher cannot submit a subject they do not teach');
select throws_ok($$ select public.unlock_marks((select math from ids), (select s6a from ids)) $$,
  '42501', null, 'a teacher cannot unlock');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select ok(public.unlock_marks((select math from ids), (select s6a from ids)), 'an admin unlocks');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.marks set cq = 55 where exam_subject_id = (select math from ids)
  and student_id = (select student_id from pupils where section = 'A' and roll = 1) $$), 1,
  'after unlocking the teacher can change marks again');

reset role;
update public.exams set status = 'review' where name_en = 'Annual Exam 2026';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.marks set cq = 60 where exam_subject_id = (select math from ids) $$), 0,
  'no changes once the exam is in review');
select throws_ok($$ select public.submit_marks((select math from ids), (select s6a from ids)) $$,
  '22023', null, 'no submitting once the exam is in review');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select count(*)::int from public.marks where exam_subject_id = (select math from ids)), 0,
  'students do not see marks of an unpublished exam');

select * from finish();
rollback;
