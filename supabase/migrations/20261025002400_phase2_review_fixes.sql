-- Phase 2 code review fixes.

-- 1. Visitors could list every file in public-media (including attachments of draft,
--    staff-only and class notices, and unpublished downloads) through the Storage API.
--    A public bucket serves files by URL without any select policy, so only admins (who
--    manage files) and teachers (their own notice folder) may list or read rows here.
drop policy "anyone reads public media" on storage.objects;

create policy "admins read public media" on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and (select app.is_admin()));

create policy "teachers read their notice files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'public-media'
    and (select app.has_role('teacher'))
    and (storage.foldername(name))[1] = 'notices'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- 2. A teacher could set attachment_path on their draft to any file (for example the
--    school logo); when an admin later deleted or replaced the draft, that file was
--    deleted too. Non-admins may only point a notice at a file in their own folder.
create function app.check_notice_attachment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.attachment_path is null or (select app.is_admin()) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.attachment_path is not distinct from old.attachment_path then
    return new;
  end if;
  if new.attachment_path not like 'notices/' || (select auth.uid())::text || '/%'
     or new.attachment_path like '%..%' then
    raise exception 'attachment must be in your own folder' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notices_attachment_check before insert or update of attachment_path
  on public.notices for each row execute function app.check_notice_attachment();

-- 3. Indexes for the lists the site and dashboard read.
create index notices_public_list_idx
  on public.notices (audience, is_pinned desc, published_at desc);
create index notices_created_by_idx on public.notices (created_by);
create index downloads_published_idx on public.downloads (published_at desc);
create index gallery_images_created_idx on public.gallery_images (created_at desc);
create index events_album_idx on public.events (album_id);
