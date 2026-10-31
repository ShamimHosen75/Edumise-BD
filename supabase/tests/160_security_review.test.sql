-- Phase 1 code review fixes.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(14);

-- Forced password change cannot be skipped by the user.
update public.profiles set must_change_password = true where id = '00000000-0000-4000-a000-000000000003';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select throws_ok($$ update public.profiles set must_change_password = false where id = auth.uid() $$,
  '42501', null, 'a user cannot clear their own must_change_password');
select throws_ok($$ update public.profiles set full_name_en = 'Kamal H.' where id = auth.uid() $$,
  '42501', null, 'names are changed by an admin (Step 6.2, D3: receipts print them)');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.profiles set must_change_password = false
  where id = '00000000-0000-4000-a000-000000000003' $$), 1, 'an admin can clear must_change_password');
select is(pg_temp.affected($$ update public.profiles set must_change_password = true
  where id = '00000000-0000-4000-a000-000000000004' $$), 1, 'an admin can force a password change');

-- Visitors read only public staff columns.
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok($$ select profile_id from public.staff $$, '42501', null, 'anon cannot read staff.profile_id');
select lives_ok($$ select full_name_en, subject_en from public.staff $$, 'anon can read public staff columns');
select is((select count(*)::int from public.public_staff), 7, 'the public staff directory still works');

-- Rate limit functions: server only.
select throws_ok($$ select public.hit_rate_limit('x', 1, 60) $$, '42501', null, 'anon cannot call hit_rate_limit');
reset role;
set local role authenticated;
select throws_ok($$ select public.is_rate_limited('x', 1, 60) $$, '42501', null, 'logged-in users cannot call is_rate_limited');
reset role;

-- Rate limit behaviour (as the service role / owner).
select is(public.hit_rate_limit('t:key', 2, 60), false, 'first hit is under the limit');
select is(public.hit_rate_limit('t:key', 2, 60), false, 'second hit reaches the limit');
select is(public.hit_rate_limit('t:key', 2, 60), true, 'third hit is over the limit');
select is(public.is_rate_limited('t:other', 2, 60), false, 'other keys are not affected');
update app.rate_limit_hits set hit_at = now() - interval '2 minutes' where key = 't:key';
select is(public.hit_rate_limit('t:key', 2, 60), false, 'old hits expire after the window');

select * from finish();
rollback;
