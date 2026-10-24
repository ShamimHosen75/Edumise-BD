-- Step 1.3: a visitor who is not logged in (anon).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(20);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

-- Allowed
select is((select count(*)::int from public.school_settings), 1, 'anon reads school settings');
select is((select count(*)::int from public.public_staff), 7, 'anon reads the public staff directory');
select is((select count(*)::int from public.governing_body), 4, 'anon reads the governing body');
select is((select count(*)::int from public.routine), 6, 'anon reads the routine');
select is((select count(*)::int from public.sections), 10, 'anon reads sections (for the routine page)');
select results_eq($$ select slug from public.notices order by slug $$,
  $$ values ('annual-exam-routine-2026'), ('class-9-registration'), ('half-yearly-result-2026'),
            ('sports-day-registration'), ('tuition-fee-deadline'), ('victory-day-holiday') $$,
  'anon sees only published public notices (not staff, class or draft)');
select is((select count(*)::int from public.pages where slug = 'history'), 0, 'anon does not see the unpublished page');
select is((select count(*)::int from public.news), 1, 'anon does not see draft news');
select is((select count(*)::int from public.exams where status = 'published'), 1, 'anon sees the published exam');

-- Forbidden
select is((select count(*)::int from public.students), 0, 'anon cannot read students');
select is((select count(*)::int from public.guardians), 0, 'anon cannot read guardians');
select is((select count(*)::int from public.staff_private), 0, 'anon cannot read staff private fields');
select is((select count(*)::int from public.profiles), 0, 'anon cannot read profiles');
select is((select count(*)::int from public.marks), 0, 'anon cannot list marks (results come via lookup in 4.3)');
select is((select count(*)::int from public.attendance), 0, 'anon cannot read attendance');
select is((select count(*)::int from public.invoices), 0, 'anon cannot read invoices');
select throws_ok($$ insert into public.notices (slug, title_en) values ('hack', 'x') $$,
  '42501', null, 'anon cannot create notices');
select is(pg_temp.affected($$ update public.school_settings set name_en = 'Hacked' $$), 0,
  'anon cannot change school settings');
select is(pg_temp.affected($$ delete from public.routine $$), 0, 'anon cannot delete the routine');
select is(app.auth_role(), null, 'anon has no role');

select * from finish();
rollback;
