-- Step 3.5: routine saving, exam schedule and holidays.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table ids as select
  (select id from public.academic_sessions where is_current) as session_id,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A') as s6a,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'B') as s6b,
  (select id from public.periods where number = 1) as p1,
  (select id from public.periods where number = 5) as p_break,
  (select id from public.subjects where code = 'MATH') as math,
  (select id from public.staff where full_name_en = 'Kamal Hossain') as kamal,
  (select id from public.rooms where name = 'Room 102') as r102;
grant select on ids to anon, authenticated;

-- Visitors: published schedules and holidays only; no writing.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select ok((select count(*) from public.holidays) > 0, 'anyone reads holidays');
select ok((select count(*) from public.exam_schedule) > 0, 'a published exam schedule is public');
select throws_ok($$ insert into public.holidays (title_en, starts_on, ends_on) values ('x', '2026-01-01', '2026-01-01') $$,
  '42501', null, 'anon cannot add holidays');
select throws_ok($$ select public.save_section_routine(1, 1, '[]') $$, '42501', null, 'anon cannot save a routine');

-- Teacher: sees schedules, cannot save routines.
reset role;
update public.exams set schedule_published = false where name_en = 'Annual Exam 2026';
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.exam_schedule), 0, 'an unpublished schedule is hidden from visitors');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select ok((select count(*) from public.exam_schedule) > 0, 'staff see an unpublished schedule');
select throws_ok($$ select public.save_section_routine((select session_id from ids), (select s6a from ids), '[]') $$,
  '42501', null, 'a teacher cannot save a routine');

-- Admin saves 6B; a teacher clash with 6A stops the whole save.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select is(public.save_section_routine((select session_id from ids), (select s6b from ids),
  (select jsonb_build_array(jsonb_build_object('day_of_week', 1, 'period_id', p1, 'subject_id', math, 'staff_id', kamal, 'room_id', r102)) from ids)),
  1, 'a section routine is saved');
select throws_ok($$ select public.save_section_routine((select session_id from ids), (select s6b from ids),
  (select jsonb_build_array(jsonb_build_object('day_of_week', 0, 'period_id', p1, 'subject_id', math, 'staff_id', kamal, 'room_id', null)) from ids)) $$,
  '23505', null, 'Kamal already teaches 6A on Sunday period 1: clash');
select is((select count(*)::int from public.routine where section_id = (select s6b from ids)), 1,
  'after a clash the old routine is kept');
select throws_ok($$ select public.save_section_routine((select session_id from ids), (select s6b from ids),
  (select jsonb_build_array(jsonb_build_object('day_of_week', 1, 'period_id', p_break, 'subject_id', math)) from ids)) $$,
  '22023', null, 'no class in a break period');
select throws_ok($$ insert into public.holidays (title_en, starts_on, ends_on) values ('x', '2026-02-02', '2026-02-01') $$,
  '23514', null, 'a holiday cannot end before it starts');
select throws_ok($$ insert into public.exam_schedule (exam_id, class_id, subject_id, exam_date, starts_at, ends_at)
  select exam_id, class_id, subject_id, exam_date, starts_at, ends_at from public.exam_schedule limit 1 $$,
  '23505', null, 'one sitting per subject per class in an exam');

select * from finish();
rollback;
