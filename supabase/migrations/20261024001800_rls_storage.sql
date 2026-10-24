-- Step 1.3 / 6: storage object policies.
-- public-media: anyone can read (logos, photos, notice PDFs); admins upload.
-- private-docs: admins only (admission documents etc.; later steps add narrower rules).

create policy "anyone reads public media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-media');

create policy "admins upload public media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and (select app.is_admin()));

create policy "admins update public media" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and (select app.is_admin()))
  with check (bucket_id = 'public-media' and (select app.is_admin()));

create policy "admins delete public media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and (select app.is_admin()));

create policy "admins manage private docs" on storage.objects
  for all to authenticated
  using (bucket_id = 'private-docs' and (select app.is_admin()))
  with check (bucket_id = 'private-docs' and (select app.is_admin()));
