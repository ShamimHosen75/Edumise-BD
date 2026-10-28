-- Step 1.3: teacher (Kamal Hossain: Mathematics in 6A, 6B, 9A; class teacher of 6A).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;

-- Look up ids as postgres, before switching role.
create temp table ids as
select
  (select st.id from public.students st where st.full_name_en = 'Arif Hossain') as student_6b,
  (select st.id from public.students st where st.full_name_en = 'Tanvir Hasan') as student_6a,
  (select st.id from public.students st where st.full_name_en = 'Nayeem Islam') as student_9b,
  (select e.section_id from public.enrollments e join public.students st on st.id = e.student_id
   where st.full_name_en = 'Arif Hossain') as section_6b,
  (select e.section_id from public.enrollments e join public.students st on st.id = e.student_id
   where st.full_name_en = 'Nayeem Islam') as section_9b,
  (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id
   join public.subjects s on s.id = es.subject_id where e.status = 'draft' and s.code = 'MATH') as annual_math,
  (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id
   join public.subjects s on s.id = es.subject_id where e.status = 'draft' and s.code = 'BAN') as annual_bangla,
  (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id
   join public.subjects s on s.id = es.subject_id where e.status = 'published' and s.code = 'MATH') as half_math;
grant select on ids to authenticated;

select plan(20);

-- Marks are entered while an exam takes marks (Step 4.2).
update public.exams set status = 'marks_entry' where status = 'draft';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';

-- Allowed
select is(app.auth_role(), 'teacher', 'teacher is recognised');
select is(cardinality(app.teacher_section_ids()), 3, 'teacher_section_ids returns 6A, 6B and 9A');
select is((select count(*)::int from public.students), 16, 'teacher reads students of own sections only (6+4+6)');
select is((select count(*)::int from public.attendance), 30, 'teacher reads attendance of own sections');
select lives_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select student_6b, section_6b, app.dhaka_today(), 'present', auth.uid() from ids $$,
  'teacher marks attendance for own section today');
select is(pg_temp.affected($$ update public.attendance set status = 'late', marked_by = auth.uid()
  where student_id = (select student_6b from ids) and date = app.dhaka_today() $$), 1,
  'teacher updates attendance for own section');
select lives_ok($$ insert into public.marks (exam_subject_id, student_id, cq, mcq)
  select annual_math, student_6a, 50, 20 from ids $$,
  'teacher enters marks for own subject in an unlocked exam');
select is((select count(*)::int from public.marks m where m.exam_subject_id = (select half_math from ids)), 6,
  'teacher reads marks of own subject');
select is((select count(*)::int from public.notices where audience = 'staff'), 1, 'teacher sees staff notices');

-- Forbidden
select is((select count(*)::int from public.students where id = (select student_9b from ids)), 0,
  'teacher cannot see a student outside own sections');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select student_9b, section_9b, app.dhaka_today(), 'present', auth.uid() from ids $$,
  '42501', null, 'teacher cannot mark attendance for another section');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select student_9b, section_6b, app.dhaka_today(), 'present', auth.uid() from ids $$,
  '42501', null, 'teacher cannot record a student under the wrong section');
select throws_ok($$ insert into public.marks (exam_subject_id, student_id, cq, mcq)
  select annual_bangla, student_6a, 50, 20 from ids $$,
  '42501', null, 'teacher cannot enter marks for another subject');
select is(pg_temp.affected($$ update public.marks set cq = 1
  where exam_subject_id = (select half_math from ids) $$), 0,
  'teacher cannot change marks once the subject is locked');
select is(pg_temp.affected($$ delete from public.marks where exam_subject_id = (select half_math from ids) $$), 0,
  'teacher cannot delete locked marks');
select is((select count(*)::int from public.invoices) + (select count(*)::int from public.fee_heads), 0,
  'teacher sees no fee data');
select is((select count(*)::int from public.staff_private), 1, 'teacher reads only own private fields');
select is(pg_temp.affected($$ update public.students set full_name_en = 'x' $$), 0, 'teacher cannot edit students');
select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'teacher cannot change own role');
select throws_ok($$ insert into public.notices (slug, title_en) values ('t-notice', 'x') $$,
  '42501', null, 'teacher cannot publish notices directly (drafts come in Step 2.3)');

select * from finish();
rollback;
