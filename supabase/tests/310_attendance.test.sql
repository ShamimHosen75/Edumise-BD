-- Step 4.1: attendance edit window and who may mark.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(9);

create temporary table ids as select
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A') as s6a,
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 9 and s.name_en = 'B') as s9b,
  (select e.student_id from public.enrollments e join public.sections s on s.id = e.section_id
   join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'A' and e.roll = 1) as st6a,
  (select e.student_id from public.enrollments e join public.sections s on s.id = e.section_id
   join public.classes c on c.id = s.class_id where c.level = 9 and s.name_en = 'B' and e.roll = 1) as st9b;
grant select on ids to authenticated;
-- Old rows for the window checks.
insert into public.attendance (student_id, section_id, date, status)
select st6a, s6a, app.dhaka_today() - 10, 'present' from ids
on conflict (student_id, date) do nothing;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select lives_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select st6a, s6a, app.dhaka_today() - 3, 'absent', auth.uid() from ids $$,
  'a teacher marks up to 3 days back');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select st6a, s6a, app.dhaka_today() - 4, 'absent', auth.uid() from ids $$,
  '42501', null, 'a teacher cannot mark 4 days back');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select st6a, s6a, app.dhaka_today() + 1, 'present', auth.uid() from ids $$,
  '42501', null, 'a teacher cannot mark a future date');
select is(pg_temp.affected($$ update public.attendance set status = 'late', marked_by = auth.uid()
  where student_id = (select st6a from ids) and date = app.dhaka_today() - 10 $$), 0, 'a teacher cannot change attendance older than 3 days');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select st6a, s6a, app.dhaka_today(), 'present', '00000000-0000-4000-a000-000000000002' from ids $$,
  '42501', null, 'a teacher cannot record attendance in someone else''s name');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status, marked_by)
  select st9b, s9b, app.dhaka_today(), 'present', auth.uid() from ids $$,
  '42501', null, 'a teacher cannot mark a section they do not teach');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.attendance set status = 'leave'
  where student_id = (select st6a from ids) and date = app.dhaka_today() - 10 $$), 1, 'an admin corrects older attendance');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status)
  select st9b, s9b, app.dhaka_today() + 1, 'present' from ids $$,
  '42501', null, 'not even an admin records a future date');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000006", "role": "authenticated"}';
select ok((select count(*) from public.attendance where student_id = (select st6a from ids)) > 0,
  'a guardian sees their child''s attendance');

select * from finish();
rollback;
