-- Step 2.2: CMS pages (attachments, empty-page detection).

-- True when the page has text in either language (tags ignored). Menu items that point
-- to an empty page are hidden on the site.
alter table public.pages
  add column has_content boolean generated always as (
    btrim(regexp_replace(body_en, '<[^>]*>', '', 'g')) <> ''
    or btrim(regexp_replace(body_bn, '<[^>]*>', '', 'g')) <> ''
  ) stored;

create table public.page_attachments (
  id bigint generated always as identity primary key,
  page_id bigint not null references public.pages (id) on delete cascade,
  label_en text not null,
  label_bn text not null default '',
  file_path text not null check (file_path ~ '^attachments/[A-Za-z0-9/_.-]+$'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index page_attachments_page_idx on public.page_attachments (page_id, sort_order);

alter table public.page_attachments enable row level security;

-- Visible exactly when the page is visible to the reader (the subquery respects page RLS).
create policy "attachments of visible pages are readable" on public.page_attachments
  for select to anon, authenticated
  using (exists (select 1 from public.pages p where p.id = page_attachments.page_id));
create policy "admins manage page attachments" on public.page_attachments
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
