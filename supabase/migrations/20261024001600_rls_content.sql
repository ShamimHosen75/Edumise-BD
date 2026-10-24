-- Step 1.3 / 4: policies for settings, academic setup, routine and website content.

-- Public reference data: anyone reads, admins write. Needed to show the routine,
-- staff directory and governing body on the public site.
do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_sessions', 'classes', 'groups', 'sections', 'subjects', 'class_subjects',
    'designations', 'periods', 'rooms', 'routine', 'governing_body'
  ] loop
    execute format(
      'create policy "anyone reads %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated '
      'using ((select app.is_admin())) with check ((select app.is_admin()))', t);
  end loop;
end;
$$;

-- school_settings: public facts; admins edit (Step 1.5 settings page). Row is created by
-- seed/setup only, so there is no insert or delete policy.
create policy "anyone reads school settings" on public.school_settings
  for select to anon, authenticated using (true);
create policy "admins update school settings" on public.school_settings
  for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- Website content: published items are public; admins see and manage everything.
do $$
declare
  t text;
begin
  foreach t in array array['news', 'events', 'pages', 'sliders', 'gallery_albums', 'downloads'] loop
    execute format(
      'create policy "anyone reads published %1$s" on public.%1$I for select to anon, authenticated '
      'using (is_published and published_at <= now())', t);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated '
      'using ((select app.is_admin())) with check ((select app.is_admin()))', t);
  end loop;
end;
$$;

-- Gallery images follow their album (the subquery itself respects album policies).
create policy "images of visible albums are readable" on public.gallery_images
  for select to anon, authenticated
  using (exists (select 1 from public.gallery_albums a where a.id = gallery_images.album_id));
create policy "admins manage gallery images" on public.gallery_images
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- Notices: published + audience. public = everyone; staff = staff roles;
-- class = staff plus students/guardians of that class.
create policy "published notices visible to their audience" on public.notices
  for select to anon, authenticated
  using (
    is_published and published_at <= now()
    and (
      audience = 'public'
      or (audience = 'staff' and (select app.is_staff()))
      or (audience = 'class' and ((select app.is_staff())
                                  or target_class_id = any ((select app.my_class_ids())::bigint[])))
    )
  );
create policy "admins manage notices" on public.notices
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
