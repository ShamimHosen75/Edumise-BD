-- Step 1.2 / 4: sessions, classes, sections, groups, subjects.

create table public.academic_sessions (
  id bigint generated always as identity primary key,
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
-- At most one current session.
create unique index academic_sessions_one_current on public.academic_sessions (is_current) where is_current;

create table public.classes (
  id bigint generated always as identity primary key,
  level smallint not null unique check (level between 6 and 10),
  name_en text not null,
  name_bn text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z_]+$'),
  name_en text not null,
  name_bn text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes (id) on delete restrict,
  name_en text not null,
  name_bn text not null default '',
  capacity smallint check (capacity > 0),
  -- class_teacher_id is added in the people migration (staff does not exist yet).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name_en)
);

create table public.subjects (
  id bigint generated always as identity primary key,
  code text not null unique,
  name_en text not null,
  name_bn text not null default '',
  type public.subject_type not null default 'compulsory',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_subjects (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes (id) on delete cascade,
  group_id bigint references public.groups (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique nulls not distinct (class_id, group_id, subject_id)
);
create index class_subjects_subject_idx on public.class_subjects (subject_id);

-- Groups (Science, Business Studies, Humanities) apply from Class 9.
create function public.class_allows_group(p_class_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select level >= 9 from public.classes where id = p_class_id), false);
$$;

create function public.check_class_subject_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is not null and not public.class_allows_group(new.class_id) then
    raise exception 'Groups apply only to Classes 9 and 10' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger class_subjects_group_check before insert or update on public.class_subjects
  for each row execute function public.check_class_subject_group();

create trigger academic_sessions_updated_at before update on public.academic_sessions
  for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger sections_updated_at before update on public.sections
  for each row execute function public.set_updated_at();
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

alter table public.academic_sessions enable row level security;
alter table public.classes enable row level security;
alter table public.groups enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
