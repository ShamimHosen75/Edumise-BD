-- Step 1.2 / 2: one row of school-wide settings (white-label branding and facts).
-- Every column here is public information shown on the website.

create table public.school_settings (
  id smallint primary key default 1 check (id = 1),
  name_en text not null,
  name_bn text not null default '',
  short_name text not null default '',
  address_en text not null default '',
  address_bn text not null default '',
  phone text not null default '',
  email text not null default '',
  website_url text not null default '',
  facebook_url text not null default '',
  youtube_url text not null default '',
  map_embed_url text not null default '',
  office_hours_en text not null default '',
  office_hours_bn text not null default '',
  logo_path text,
  favicon_path text,
  primary_color text not null default '#0f766e' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#f59e0b' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  eiin text not null default '',
  institution_code text not null default '',
  center_code text not null default '',
  established_year smallint check (established_year between 1800 and 2100),
  head_name_en text not null default '',
  head_name_bn text not null default '',
  head_photo_path text,
  head_message_en text not null default '',
  head_message_bn text not null default '',
  -- Days of week the school is open, 0 = Sunday ... 6 = Saturday. Default Saturday to Thursday.
  working_days smallint[] not null default '{6,0,1,2,3,4}'
    check (working_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  -- Bangladesh SSC grading scale; configurable (used from Step 4.3).
  grading jsonb not null default '[
    {"min": 80, "grade": "A+", "point": 5.00},
    {"min": 70, "grade": "A",  "point": 4.00},
    {"min": 60, "grade": "A-", "point": 3.50},
    {"min": 50, "grade": "B",  "point": 3.00},
    {"min": 40, "grade": "C",  "point": 2.00},
    {"min": 33, "grade": "D",  "point": 1.00},
    {"min": 0,  "grade": "F",  "point": 0.00}
  ]'::jsonb check (jsonb_typeof(grading) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger school_settings_updated_at before update on public.school_settings
  for each row execute function public.set_updated_at();

alter table public.school_settings enable row level security;
