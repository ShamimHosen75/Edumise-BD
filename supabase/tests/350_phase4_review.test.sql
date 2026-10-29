-- Phase 4 code review: regression tests for the fixes in 20261030003500_phase4_review_fixes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table ids as select
  (select id from public.exams where name_en = 'Half Yearly Exam 2026') as half,
  (select id from public.exams where name_en = 'Annual Exam 2026') as annual,
  (select id from public.classes where level = 9) as class9,
  (select id from public.sections where id = 8) as s9b,
  (select id from public.subjects where code = 'ACC') as acc,
  (select id from public.staff where profile_id = '00000000-0000-4000-a000-000000000003') as kamal,
  (select id from public.staff where profile_id = '00000000-0000-4000-a000-000000000004') as rafiq,
  (select id from public.students where full_name_en = 'Rahim Ahmed') as rahim;
grant select on ids to authenticated;

-- Results go out of date when a mark is deleted or an enrolment changes (review C1/C2).
select ok(app.results_current((select half from ids)), 'seeded results are current');
delete from public.marks where student_id = (select rahim from ids)
  and exam_subject_id = (select min(id) from public.exam_subjects where exam_id = (select half from ids));
select ok(not app.results_current((select half from ids)), 'deleting a mark makes the results out of date');
update public.exams set results_processed_at = now() + interval '1 minute' where id = (select half from ids);
update public.enrollments set roll = roll + 50 where student_id = (select rahim from ids);
update public.exams set results_processed_at = now() - interval '1 minute' where id = (select half from ids);
select ok(not app.results_current((select half from ids)), 'an enrolment change makes the results out of date');
update public.enrollments set roll = roll - 50 where student_id = (select rahim from ids);

-- Set-up: the Annual exam takes marks; Accounting (business group only) in Class 9 B.
update public.exams set status = 'marks_entry' where id = (select annual from ids);
insert into public.exam_classes (exam_id, class_id) select annual, class9 from ids on conflict do nothing;
insert into public.exam_subjects (exam_id, class_id, subject_id, cq_full, cq_pass, mcq_full, mcq_pass)
select annual, class9, acc, 70, 23, 30, 10 from ids;
create temporary table acc as
  select id from public.exam_subjects where exam_id = (select annual from ids) and subject_id = (select acc from ids);
grant select on acc to authenticated;
insert into public.teacher_assignments (session_id, staff_id, section_id, subject_id)
select e.session_id, i.kamal, i.s9b, i.acc from public.exams e, ids i where e.id = i.annual;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
-- Only the business students take Accounting; one has CQ but no MCQ yet.
insert into public.marks (exam_subject_id, student_id, cq, mcq, entered_by)
select (select id from acc), en.student_id, 50, case when st.full_name_en = 'Nayeem Islam' then null else 20 end,
  '00000000-0000-4000-a000-000000000002'
from public.enrollments en join public.students st on st.id = en.student_id
join public.groups g on g.id = en.group_id
where en.section_id = (select s9b from ids) and g.code = 'business';
select is((select array_agg(distinct entered_by::text) from public.marks where exam_subject_id = (select id from acc)),
  array['00000000-0000-4000-a000-000000000003'], 'the author of a mark is the teacher who saved it, whatever was sent (S3)');
select throws_ok($$ select public.submit_marks((select id from acc), (select s9b from ids)) $$, '23514', null,
  'a row with a part left empty is not complete (C5)');
update public.marks set mcq = 15 where exam_subject_id = (select id from acc) and mcq is null;
select is(public.submit_marks((select id from acc), (select s9b from ids)), 2,
  'submit counts only the students who take the subject: humanities students are not missing (C2)');

reset role;
delete from public.mark_locks where exam_subject_id = (select id from acc);
update public.teacher_assignments set staff_id = (select rafiq from ids)
where section_id = (select s9b from ids) and subject_id = (select acc from ids);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';
select throws_ok($$ select public.submit_marks((select id from acc), (select s9b from ids)) $$, '42501', null,
  'a non-teacher with an old assignment cannot submit (S4)');

reset role;
update public.teacher_assignments set staff_id = (select kamal from ids)
where section_id = (select s9b from ids) and subject_id = (select acc from ids);
update public.students set status = 'transferred'
where id = (select student_id from public.marks where exam_subject_id = (select id from acc) limit 1);
delete from public.marks where exam_subject_id = (select id from acc)
  and student_id in (select id from public.students where status = 'transferred');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(public.submit_marks((select id from acc), (select s9b from ids)), 1,
  'a transferred student is not counted (results C3)');

reset role;
select throws_ok($$ update public.exam_subjects set cq_full = 40 where id = (select id from acc) $$, '23514', null,
  'full marks cannot drop below saved marks (C3)');
select lives_ok($$ update public.exam_subjects set cq_full = 60 where id = (select id from acc) $$,
  'full marks can change while saved marks still fit');

-- Unpublished results: the class teacher sees them, a subject teacher does not (S6).
update public.exams set status = 'review' where id = (select half from ids);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.results where exam_id = (select half from ids)), 6,
  'before publishing Kamal sees only 6A (his class), not 6B where he only teaches Maths');

-- Attendance counts in SQL (P1) match the rows.
reset role;
select is(
  (select present + absent + late + on_leave from public.attendance_counts(
    array[(select id from public.sections where id = 1)], '2000-01-01', '2100-01-01')
   where student_id = (select rahim from ids)),
  (select count(*)::int from public.attendance a where a.student_id = (select rahim from ids)
    and extract(dow from a.date)::smallint = any ((select working_days from public.school_settings limit 1)::smallint[])
    and not exists (select 1 from public.holidays h where a.date between h.starts_on and h.ends_on)),
  'attendance_counts counts school days only');
set local role anon;
select throws_ok($$ select * from public.attendance_counts(array[1::bigint], '2026-01-01', '2026-12-31') $$,
  '42501', null, 'visitors cannot call attendance_counts');

select * from finish();
rollback;
