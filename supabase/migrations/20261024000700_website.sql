-- Step 1.2 / 7: website content. Each item is public only when is_published is true
-- and published_at has passed (enforced by RLS in Step 1.3).

create table public.notices (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_bn text not null default '',
  body_en text not null default '',
  body_bn text not null default '',
  category public.notice_category not null default 'general',
  audience public.notice_audience not null default 'public',
  target_class_id bigint references public.classes (id) on delete cascade,
  is_pinned boolean not null default false,
  attachment_path text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((audience = 'class') = (target_class_id is not null)),
  check (not is_published or published_at is not null)
);
create index notices_published_idx on public.notices (is_published, published_at desc);

create table public.news (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_bn text not null default '',
  body_en text not null default '',
  body_bn text not null default '',
  cover_path text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);
create index news_published_idx on public.news (is_published, published_at desc);

create table public.events (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_bn text not null default '',
  body_en text not null default '',
  body_bn text not null default '',
  venue_en text not null default '',
  venue_bn text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  cover_path text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check (not is_published or published_at is not null)
);
create index events_starts_idx on public.events (starts_at);

create table public.pages (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_bn text not null default '',
  body_en text not null default '',
  body_bn text not null default '',
  cover_path text,
  seo_title_en text not null default '',
  seo_title_bn text not null default '',
  seo_description_en text not null default '',
  seo_description_bn text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table public.sliders (
  id bigint generated always as identity primary key,
  image_path text not null,
  title_en text not null default '',
  title_bn text not null default '',
  subtitle_en text not null default '',
  subtitle_bn text not null default '',
  link_url text,
  sort_order smallint not null default 0,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table public.gallery_albums (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_bn text not null default '',
  cover_path text,
  event_date date,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table public.gallery_images (
  id bigint generated always as identity primary key,
  album_id bigint not null references public.gallery_albums (id) on delete cascade,
  image_path text not null,
  caption_en text not null default '',
  caption_bn text not null default '',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_images_album_idx on public.gallery_images (album_id, sort_order);

create table public.downloads (
  id bigint generated always as identity primary key,
  title_en text not null,
  title_bn text not null default '',
  category text not null default 'general',
  file_path text not null,
  file_size bigint check (file_size >= 0),
  mime_type text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create trigger notices_updated_at before update on public.notices
  for each row execute function public.set_updated_at();
create trigger news_updated_at before update on public.news
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger sliders_updated_at before update on public.sliders
  for each row execute function public.set_updated_at();
create trigger gallery_albums_updated_at before update on public.gallery_albums
  for each row execute function public.set_updated_at();
create trigger downloads_updated_at before update on public.downloads
  for each row execute function public.set_updated_at();

alter table public.notices enable row level security;
alter table public.news enable row level security;
alter table public.events enable row level security;
alter table public.pages enable row level security;
alter table public.sliders enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_images enable row level security;
alter table public.downloads enable row level security;
