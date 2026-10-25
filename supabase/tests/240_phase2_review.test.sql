-- Phase 2 code review: storage listing and notice attachment paths.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(8);

insert into storage.objects (bucket_id, name)
  values ('public-media', 'notices/00000000-0000-4000-a000-000000000002/staff-only.pdf'),
         ('public-media', 'notices/00000000-0000-4000-a000-000000000003/mine.pdf');
insert into public.notices (slug, title_en, created_by)
  values ('t-teacher-file', 'Teacher draft', '00000000-0000-4000-a000-000000000003');

-- Visitors cannot list files (public files are still served by URL).
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from storage.objects where bucket_id = 'public-media'), 0,
  'anon cannot list public-media files');

-- Teachers see only their own notice folder and may only attach files from it.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is((select count(*)::int from storage.objects where bucket_id = 'public-media'), 1,
  'a teacher sees only their own notice files');
select throws_ok($$ update public.notices set attachment_path = 'settings/logo.png' where slug = 't-teacher-file' $$,
  '42501', null, 'a teacher cannot point a draft at another file');
select throws_ok($$ update public.notices set attachment_path = 'notices/00000000-0000-4000-a000-000000000002/staff-only.pdf'
  where slug = 't-teacher-file' $$, '42501', null, 'a teacher cannot point a draft at another person''s file');
select throws_ok($$ update public.notices set attachment_path = 'notices/00000000-0000-4000-a000-000000000003/../../settings/logo.png'
  where slug = 't-teacher-file' $$, '42501', null, 'a teacher cannot climb out of their folder');
select is(pg_temp.affected($$ update public.notices
  set attachment_path = 'notices/00000000-0000-4000-a000-000000000003/mine.pdf' where slug = 't-teacher-file' $$), 1,
  'a teacher can attach a file from their own folder');

-- Admins list files and may attach any file.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select ok((select count(*) from storage.objects where bucket_id = 'public-media') >= 2, 'admins list public-media files');
select is(pg_temp.affected($$ update public.notices set attachment_path = 'demo/notice-sample.pdf' where slug = 't-teacher-file' $$), 1,
  'an admin can attach any file');

select * from finish();
rollback;
