-- Step 1.2 / 12: storage buckets. Access rules for objects are added in Step 1.3.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('private-docs', 'private-docs', false, 2097152,
    array['image/jpeg', 'image/png', 'application/pdf']);
