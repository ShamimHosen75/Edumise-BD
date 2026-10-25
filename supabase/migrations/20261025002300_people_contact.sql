-- Step 2.4: former head teachers and the contact form inbox.

create table public.ex_principals (
  id bigint generated always as identity primary key,
  full_name_en text not null,
  full_name_bn text not null default '',
  photo_path text,
  from_year smallint not null check (from_year between 1800 and 2100),
  to_year smallint not null check (to_year between 1800 and 2100),
  note_en text not null default '',
  note_bn text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_year >= from_year)
);
create index ex_principals_years_idx on public.ex_principals (to_year desc, from_year desc);

create trigger ex_principals_updated_at before update on public.ex_principals
  for each row execute function public.set_updated_at();

alter table public.ex_principals enable row level security;
create policy "anyone reads ex principals" on public.ex_principals
  for select to anon, authenticated using (true);
create policy "admins manage ex principals" on public.ex_principals
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- Messages from the public contact form. The server writes them with the service role
-- after its honeypot and rate-limit checks, so there is no insert policy for anyone.
create table public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 100),
  phone text not null check (public.is_bd_phone(phone)),
  email text not null default '' check (length(email) <= 200),
  subject text not null check (length(subject) between 1 and 150),
  message text not null check (length(message) between 1 and 2000),
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index contact_messages_inbox_idx on public.contact_messages (is_read, created_at desc);

alter table public.contact_messages enable row level security;
create policy "admins read contact messages" on public.contact_messages
  for select to authenticated using ((select app.is_admin()));
create policy "admins mark contact messages" on public.contact_messages
  for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy "admins delete contact messages" on public.contact_messages
  for delete to authenticated using ((select app.is_admin()));
