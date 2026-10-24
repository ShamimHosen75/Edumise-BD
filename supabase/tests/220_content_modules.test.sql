-- Step 2.3: notices, news, events, gallery and downloads.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(24);

-- Integrity.
select throws_ok($$ insert into public.downloads (title_en, category, file_path) values ('x', 'music', 'a.pdf') $$,
  '23514', null, 'downloads use the fixed categories');
select throws_ok($$ insert into public.downloads (title_en, is_published, published_at) values ('x', true, now()) $$,
  '23514', null, 'a published download must have a file');
select lives_ok($$ insert into public.downloads (title_en) values ('t-draft-download') $$,
  'a draft download may wait for its file');
select has_column('public', 'events', 'album_id', 'events link to a photo album');

-- Test data, written as the database owner.
insert into public.notices (slug, title_en, is_published, created_by)
  values ('t-admin-draft', 'Admin draft', false, '00000000-0000-4000-a000-000000000002');
insert into public.notices (slug, title_en, is_published, published_at)
  values ('t-scheduled', 'Scheduled', true, now() + interval '1 day');
insert into public.news (slug, title_en) values ('t-news-draft', 'Draft news');
insert into public.events (slug, title_en, starts_at) values ('t-event-draft', 'Draft event', now());
insert into public.gallery_albums (slug, title_en) values ('t-album-draft', 'Draft album');

-- Visitors never see drafts or scheduled items.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.notices where slug in ('t-admin-draft', 't-scheduled')), 0,
  'anon sees neither draft nor scheduled notices');
select is((select count(*)::int from public.news where slug = 't-news-draft'), 0, 'anon does not see draft news');
select is((select count(*)::int from public.events where slug = 't-event-draft'), 0, 'anon does not see draft events');
select is((select count(*)::int from public.gallery_albums where slug = 't-album-draft'), 0,
  'anon does not see draft albums');
select is((select count(*)::int from public.downloads where title_en = 't-draft-download'), 0,
  'anon does not see draft downloads');

-- Teachers write notice drafts only.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select lives_ok($$ insert into public.notices (slug, title_en, created_by)
  values ('t-teacher-draft', 'Teacher draft', '00000000-0000-4000-a000-000000000003') $$,
  'a teacher can write a notice draft');
select throws_ok($$ insert into public.notices (slug, title_en, created_by, is_published, published_at)
  values ('t-teacher-pub', 'x', '00000000-0000-4000-a000-000000000003', true, now()) $$,
  '42501', null, 'a teacher cannot publish a notice');
select throws_ok($$ insert into public.notices (slug, title_en, created_by)
  values ('t-teacher-other', 'x', '00000000-0000-4000-a000-000000000002') $$,
  '42501', null, 'a teacher cannot write a notice in someone else''s name');
select is((select count(*)::int from public.notices where slug = 't-teacher-draft'), 1, 'a teacher sees their own draft');
select is((select count(*)::int from public.notices where slug = 't-admin-draft'), 0, 'a teacher does not see others'' drafts');
select is(pg_temp.affected($$ update public.notices set title_en = 'Edited' where slug = 't-teacher-draft' $$), 1,
  'a teacher can edit their own draft');
select throws_ok($$ update public.notices set is_published = true, published_at = now() where slug = 't-teacher-draft' $$,
  '42501', null, 'a teacher cannot publish their own draft');
select is(pg_temp.affected($$ update public.notices set title_en = 'x' where slug = 't-admin-draft' $$), 0,
  'a teacher cannot edit others'' drafts');
select is(pg_temp.affected($$ update public.notices set title_en = 'x' where is_published $$), 0,
  'a teacher cannot edit published notices');
select is(pg_temp.affected($$ delete from public.notices where is_published $$), 0,
  'a teacher cannot delete published notices');
select throws_ok($$ insert into public.news (slug, title_en) values ('t-teacher-news', 'x') $$,
  '42501', null, 'a teacher cannot write news');

-- Teachers upload notice files into their own folder only.
select lives_ok($$ insert into storage.objects (bucket_id, name)
  values ('public-media', 'notices/00000000-0000-4000-a000-000000000003/a.pdf') $$,
  'a teacher can upload into their notice folder');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('public-media', 'notices/00000000-0000-4000-a000-000000000002/a.pdf') $$,
  '42501', null, 'a teacher cannot upload into someone else''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('public-media', 'news/00000000-0000-4000-a000-000000000003/a.png') $$,
  '42501', null, 'a teacher cannot upload outside notices');

-- Admins publish the teacher's draft.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select is(pg_temp.affected($$ update public.notices set is_published = true, published_at = now()
  where slug = 't-teacher-draft' $$), 1, 'an admin publishes a teacher''s draft');

select * from finish();
rollback;
