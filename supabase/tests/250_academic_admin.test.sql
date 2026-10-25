-- Step 3.1: academic setup.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.academic_sessions (name, starts_on, ends_on) values ('t-2099', '2099-01-01', '2099-12-31');

-- A teacher cannot change the current session (RLS: the function changes nothing).
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is(public.set_current_session((select id from public.academic_sessions where name = 't-2099')), false,
  'a teacher cannot make a session current');
select is((select name from public.academic_sessions where is_current), '2026', 'the current session is unchanged');

-- An admin switches the current session in one step.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select is(public.set_current_session((select id from public.academic_sessions where name = 't-2099')), true,
  'an admin makes a session current');
select is((select count(*)::int from public.academic_sessions where is_current), 1, 'exactly one session is current');
select is((select name from public.academic_sessions where is_current), 't-2099', 'the chosen session is current');
select is(public.set_current_session(999999), false, 'an unknown session changes nothing');
select is((select count(*)::int from public.academic_sessions where is_current), 1, 'still exactly one current session');

-- Section names are unique in a class whatever their case.
select throws_ok($$ insert into public.sections (class_id, name_en) select class_id, lower(name_en) from public.sections limit 1 $$,
  '23505', null, 'section "a" clashes with "A" in the same class');

select * from finish();
rollback;
