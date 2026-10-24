-- Step 1.2 / 6: public directory of staff, and the governing body.

-- Only public staff columns. security_invoker = true means the reader's own permissions
-- apply (Step 1.3 grants anon access to exactly these columns of staff).
create view public.public_staff
with (security_invoker = true)
as
select
  s.id,
  s.full_name_en,
  s.full_name_bn,
  s.photo_path,
  d.name_en as designation_en,
  d.name_bn as designation_bn,
  d.rank as designation_rank,
  s.subject_en,
  s.subject_bn,
  s.qualification_en,
  s.qualification_bn,
  s.bio_en,
  s.bio_bn,
  extract(year from s.joined_on)::smallint as joining_year,
  (s.left_on is null) as is_current,
  s.sort_order
from public.staff s
join public.designations d on d.id = s.designation_id
where s.is_public;

create table public.governing_body (
  id bigint generated always as identity primary key,
  full_name_en text not null,
  full_name_bn text not null default '',
  position_en text not null,
  position_bn text not null default '',
  photo_path text,
  term_start date not null,
  term_end date,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (term_end is null or term_end >= term_start)
);

create trigger governing_body_updated_at before update on public.governing_body
  for each row execute function public.set_updated_at();

alter table public.governing_body enable row level security;
