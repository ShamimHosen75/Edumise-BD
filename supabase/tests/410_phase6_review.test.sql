-- Phase 6 code review: regression tests (docs/code-review-phase-6.md).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(10);

-- S1: only a super admin gives or takes the admin role, or touches another admin's login --
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select throws_ok($$ update public.profiles set role = 'admin'
  where id = '00000000-0000-4000-a000-000000000004' $$, '42501', null,
  'S1: an admin cannot make the accountant an admin');
select throws_ok($$ update public.profiles set role = 'teacher'
  where id = '00000000-0000-4000-a000-000000000002' $$, '42501', null,
  'nor give up their own admin role (another admin or a super admin does that)');
select throws_ok($$ update public.profiles set is_active = false
  where id = '00000000-0000-4000-a000-000000000001' $$, '42501', null,
  'nor switch the super admin off');
select is(pg_temp.affected($$ update public.profiles set role = 'accountant'
  where id = '00000000-0000-4000-a000-000000000003' $$), 1,
  'an admin can still change a teacher into an accountant');
select is(pg_temp.affected($$ update public.profiles set phone = '01700000099'
  where id = '00000000-0000-4000-a000-000000000002' $$), 1,
  'and change their own phone');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.profiles set role = 'admin'
  where id = '00000000-0000-4000-a000-000000000004' $$), 1,
  'a super admin can make an admin');
select is(pg_temp.affected($$ update public.profiles set role = 'accountant'
  where id = '00000000-0000-4000-a000-000000000004' $$), 1, 'and unmake one');

-- S5: a successful sign-in clears the failure counters (service role only) -----------------
reset role;
set local request.jwt.claims to '{}';
select ok(not has_function_privilege('authenticated', 'public.clear_rate_limit(text)', 'execute')
  and not has_function_privilege('anon', 'public.clear_rate_limit(text)', 'execute'),
  'S5: browsers cannot clear a rate limit');
select ok(not public.hit_rate_limit('review-key', 2, 60) and not public.hit_rate_limit('review-key', 2, 60)
  and public.hit_rate_limit('review-key', 2, 60), 'the third hit is over a limit of two');
select ok((select public.clear_rate_limit('review-key') is null)
  and not public.hit_rate_limit('review-key', 2, 60), 'cleared, the key starts again');

select * from finish();
rollback;
