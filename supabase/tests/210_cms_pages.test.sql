-- Step 2.2: page attachments and empty-page detection.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(11);

-- has_content ignores tags and whitespace, in either language.
select is((select has_content from public.pages where slug = 'donors'), false, 'a page with no text is empty');
insert into public.pages (slug, title_en, body_en, body_bn) values ('t-blank', 'x', '<p> </p><br>', '');
select is((select has_content from public.pages where slug = 't-blank'), false, 'tags and spaces alone count as empty');
update public.pages set body_bn = '<p>লেখা</p>' where slug = 't-blank';
select is((select has_content from public.pages where slug = 't-blank'), true, 'Bangla text alone makes a page non-empty');

-- Attachments: integrity.
select throws_ok($$ insert into public.page_attachments (page_id, label_en, file_path, mime_type, file_size)
  select id, 'x', 'attachments/1/a.exe', 'application/x-msdownload', 10 from public.pages limit 1 $$,
  '23514', null, 'only PDF and image attachments are allowed');
select throws_ok($$ insert into public.page_attachments (page_id, label_en, file_path, mime_type, file_size)
  select id, 'x', '../../etc/passwd', 'application/pdf', 10 from public.pages limit 1 $$,
  '23514', null, 'attachment paths must stay inside attachments/');

insert into public.page_attachments (page_id, label_en, file_path, mime_type, file_size)
select id, 'Public file', 'attachments/1/public.pdf', 'application/pdf', 100 from public.pages where slug = 'library';
insert into public.page_attachments (page_id, label_en, file_path, mime_type, file_size)
select id, 'Draft file', 'attachments/2/draft.pdf', 'application/pdf', 100 from public.pages where slug = 'history';

-- Visitors see attachments of published pages only, and cannot change them.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.page_attachments where label_en = 'Public file'), 1,
  'anon sees attachments of a published page');
select is((select count(*)::int from public.page_attachments where label_en = 'Draft file'), 0,
  'anon does not see attachments of an unpublished page');
select throws_ok($$ insert into public.page_attachments (page_id, label_en, file_path, mime_type, file_size)
  values (1, 'x', 'attachments/1/x.pdf', 'application/pdf', 1) $$, '42501', null, 'anon cannot add attachments');
select is(pg_temp.affected($$ delete from public.page_attachments $$), 0, 'anon cannot delete attachments');

-- A teacher cannot edit pages; an admin can see drafts.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.pages set title_en = 'x' $$), 0, 'a teacher cannot edit pages');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is((select count(*)::int from public.pages where slug = 'history'), 1, 'an admin sees unpublished pages');

select * from finish();
rollback;
