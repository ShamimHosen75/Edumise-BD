-- Step 2.4: former head teachers, contact messages and the public staff directory.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(18);

-- Integrity.
select throws_ok($$ insert into public.ex_principals (full_name_en, from_year, to_year) values ('x', 2000, 1990) $$,
  '23514', null, 'a former head teacher cannot leave before joining');
select throws_ok($$ insert into public.contact_messages (name, phone, subject, message) values ('x', '12345', 's', 'm') $$,
  '23514', null, 'contact messages need a Bangladesh mobile number');
select throws_ok($$ insert into public.contact_messages (name, phone, subject, message)
  values ('x', '01711000000', 's', repeat('m', 2001)) $$, '23514', null, 'contact messages are at most 2000 characters');

-- The public directory view has no private columns.
select hasnt_column('public', 'public_staff', 'nid', 'public_staff has no NID');
select hasnt_column('public', 'public_staff', 'birth_date', 'public_staff has no birth date');
select hasnt_column('public', 'public_staff', 'address', 'public_staff has no address');
select hasnt_column('public', 'public_staff', 'personal_phone', 'public_staff has no personal phone');

-- Visitors: read former head teachers, nothing else.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select ok((select count(*) from public.ex_principals) > 0, 'anon reads former head teachers');
select throws_ok($$ insert into public.ex_principals (full_name_en, from_year, to_year) values ('x', 1990, 2000) $$,
  '42501', null, 'anon cannot add former head teachers');
select is((select count(*)::int from public.contact_messages), 0, 'anon cannot read contact messages');
select throws_ok($$ insert into public.contact_messages (name, phone, subject, message)
  values ('x', '01711000000', 's', 'a message') $$, '42501', null, 'anon cannot write contact messages directly');

-- A teacher cannot see the inbox.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is((select count(*)::int from public.contact_messages), 0, 'a teacher cannot read contact messages');
select is(pg_temp.affected($$ update public.contact_messages set is_read = true $$), 0, 'a teacher cannot mark messages');
select is(pg_temp.affected($$ update public.ex_principals set full_name_en = 'x' $$), 0,
  'a teacher cannot edit former head teachers');

-- Admins read, mark and delete messages.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select ok((select count(*) from public.contact_messages) > 0, 'an admin reads contact messages');
select ok(pg_temp.affected($$ update public.contact_messages set is_read = true, read_at = now() $$) > 0,
  'an admin marks messages as read');
select ok(pg_temp.affected($$ delete from public.contact_messages $$) > 0, 'an admin deletes messages');
select lives_ok($$ insert into public.ex_principals (full_name_en, from_year, to_year) values ('t-head', 1960, 1975) $$,
  'an admin adds a former head teacher');

select * from finish();
rollback;
