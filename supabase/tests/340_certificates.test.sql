-- Step 4.4: certificates are issued and revoked only by admins through functions, never
-- edited, and verified only through the server's lookup (name, type, date, status).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(19);

create temporary table ids as select
  (select id from public.students where full_name_en = 'Nusrat Jahan') as nusrat;
grant select on ids to authenticated, anon, service_role;

set local role anon;
select is((select count(*)::int from public.certificates), 0, 'visitors cannot read certificates');
select ok(not has_function_privilege('anon', 'public.verify_certificate(text)', 'execute'),
  'visitors cannot call the verify lookup directly (the server rate-limits it)');
select ok(not has_function_privilege('authenticated', 'public.verify_certificate(text)', 'execute'),
  'logged-in users cannot call it directly either');

reset role;
set local role service_role;
select is(public.verify_certificate('TS-7KQ2-M9XA-4P') ->> 'name_en', 'Tanvir Hasan', 'a valid certificate is found');
select is((select array_agg(k order by k) from jsonb_object_keys(public.verify_certificate('TS-7KQ2-M9XA-4P')) k),
  array['issued_on', 'name_bn', 'name_en', 'reference', 'revoked', 'revoked_on', 'type'],
  'verify returns only name, type, dates and status');
select is((public.verify_certificate('CC-H3RD-8WJY-6T') ->> 'revoked')::boolean, true, 'a revoked certificate shows as revoked');
select is(public.verify_certificate('TC-2222-2222-22'), null, 'an unknown reference finds nothing');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is((select count(*)::int from public.certificates), 0, 'teachers cannot read certificates');
select throws_ok($$ select public.issue_certificate((select nusrat from ids), 'testimonial', 'TS-3333-3333-33', 'x', '') $$,
  '42501', null, 'teachers cannot issue');
select throws_ok($$ select public.revoke_certificate(1, 'x') $$, '42501', null, 'teachers cannot revoke');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000005", "role": "authenticated"}';
select is((select count(*)::int from public.certificates), 0, 'students cannot read certificates');

set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select throws_ok($$ insert into public.certificates (reference, type, student_name_en, body_en)
  values ('TS-4444-4444-44', 'testimonial', 'X', 'x') $$, '42501', null, 'nobody inserts directly, not even admins');
select is(pg_temp.affected($$ update public.certificates set body_en = 'changed' $$), 0,
  'an issued certificate cannot be edited');
select ok(public.issue_certificate((select nusrat from ids), 'transfer', 'TC-5555-5555-55', 'Body', 'লেখা') > 0,
  'an admin issues a transfer certificate');
select is((select status::text from public.students where id = (select nusrat from ids)), 'transferred',
  'a transfer certificate marks the student as transferred');
select throws_ok($$ select public.issue_certificate((select nusrat from ids), 'transfer', 'TC-5555-5555-55', 'x', '') $$,
  '23505', null, 'a reference is used once');
select throws_ok($$ select public.issue_certificate((select nusrat from ids), 'character', 'TS-6666-6666-66', 'x', '') $$,
  '23514', null, 'the prefix must match the type (and the format is checked)');
select ok(public.revoke_certificate((select id from public.certificates where reference = 'TC-5555-5555-55'), 'Issued by mistake'),
  'an admin revokes a certificate');
select ok(not public.revoke_certificate((select id from public.certificates where reference = 'TC-5555-5555-55'), 'again'),
  'a revoked certificate stays revoked');

select * from finish();
rollback;
