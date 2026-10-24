-- Step 2.3: notices, news, events, gallery and downloads.

-- Events show photos from a gallery album.
alter table public.events
  add column album_id bigint references public.gallery_albums (id) on delete set null;

-- Downloads get a fixed set of categories (shown as filters).
alter table public.downloads
  add constraint downloads_category_check
  check (category in ('general', 'forms', 'syllabus', 'routine', 'results', 'calendar'));

-- A download is saved first and its file uploaded after, so the file may be missing on a
-- draft. A published download always has one.
alter table public.downloads alter column file_path drop not null;
alter table public.downloads
  add constraint downloads_published_has_file
  check (not is_published or file_path is not null);

-- Teachers may write notice drafts and change or delete their own drafts. Only admins
-- publish (is_published stays false for teachers, checked on insert and update).
create policy "teachers read own notice drafts" on public.notices
  for select to authenticated
  using ((select app.has_role('teacher')) and created_by = (select auth.uid()));

create policy "teachers create notice drafts" on public.notices
  for insert to authenticated
  with check ((select app.has_role('teacher')) and created_by = (select auth.uid()) and not is_published);

create policy "teachers edit own notice drafts" on public.notices
  for update to authenticated
  using ((select app.has_role('teacher')) and created_by = (select auth.uid()) and not is_published)
  with check ((select app.has_role('teacher')) and created_by = (select auth.uid()) and not is_published);

create policy "teachers delete own notice drafts" on public.notices
  for delete to authenticated
  using ((select app.has_role('teacher')) and created_by = (select auth.uid()) and not is_published);

-- Teachers upload notice attachments only into their own folder: notices/<user id>/...
create policy "teachers upload notice files to their folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and (select app.has_role('teacher'))
    and (storage.foldername(name))[1] = 'notices'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
