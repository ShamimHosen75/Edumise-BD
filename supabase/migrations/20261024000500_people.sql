-- Step 1.2 / 5: staff, students, guardians, enrolments and teaching assignments.
-- PRIVATE columns (never on public pages): nid, birth_date, address, personal_phone.

create table public.designations (
  id bigint generated always as identity primary key,
  name_en text not null unique,
  name_bn text not null default '',
  rank smallint not null unique,
  is_teaching boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id bigint generated always as identity primary key,
  profile_id uuid unique references public.profiles (id) on delete set null,
  designation_id bigint not null references public.designations (id) on delete restrict,
  -- Public fields
  full_name_en text not null,
  full_name_bn text not null default '',
  photo_path text,
  subject_en text not null default '',
  subject_bn text not null default '',
  qualification_en text not null default '',
  qualification_bn text not null default '',
  bio_en text not null default '',
  bio_bn text not null default '',
  joined_on date,
  left_on date,
  is_public boolean not null default true,
  sort_order smallint not null default 0,
  -- Private fields
  nid text check (nid is null or nid ~ '^([0-9]{10}|[0-9]{13}|[0-9]{17})$'),
  birth_date date,
  address text,
  personal_phone text check (personal_phone is null or public.is_bd_phone(personal_phone)),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);
create index staff_designation_idx on public.staff (designation_id);

alter table public.sections
  add column class_teacher_id bigint references public.staff (id) on delete set null;

create table public.students (
  id bigint generated always as identity primary key,
  profile_id uuid unique references public.profiles (id) on delete set null,
  student_code text not null unique,
  full_name_en text not null,
  full_name_bn text not null default '',
  gender public.gender not null,
  religion public.religion,
  blood_group public.blood_group,
  photo_path text,
  status public.student_status not null default 'active',
  admitted_on date,
  -- Private fields
  birth_date date,
  birth_reg_no text unique check (birth_reg_no is null or birth_reg_no ~ '^[0-9]{17}$'),
  address text,
  personal_phone text check (personal_phone is null or public.is_bd_phone(personal_phone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardians (
  id bigint generated always as identity primary key,
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name_en text not null,
  full_name_bn text not null default '',
  phone text not null check (public.is_bd_phone(phone)),
  email text,
  occupation text not null default '',
  -- Private fields
  nid text check (nid is null or nid ~ '^([0-9]{10}|[0-9]{13}|[0-9]{17})$'),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_phone_idx on public.guardians (phone);

create table public.student_guardians (
  student_id bigint not null references public.students (id) on delete cascade,
  guardian_id bigint not null references public.guardians (id) on delete cascade,
  relation text not null check (relation in ('father', 'mother', 'other')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);
create index student_guardians_guardian_idx on public.student_guardians (guardian_id);

create table public.enrollments (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  session_id bigint not null references public.academic_sessions (id) on delete restrict,
  section_id bigint not null references public.sections (id) on delete restrict,
  group_id bigint references public.groups (id) on delete restrict,
  roll smallint not null check (roll > 0),
  fourth_subject_id bigint references public.subjects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_id),
  unique (session_id, section_id, roll)
);
create index enrollments_section_idx on public.enrollments (section_id, session_id);

create function public.check_enrollment_group()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_class_id bigint;
begin
  if new.group_id is not null then
    select class_id into v_class_id from public.sections where id = new.section_id;
    if not public.class_allows_group(v_class_id) then
      raise exception 'Groups apply only to Classes 9 and 10' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger enrollments_group_check before insert or update on public.enrollments
  for each row execute function public.check_enrollment_group();

-- One teacher per subject per section per session.
create table public.teacher_assignments (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.academic_sessions (id) on delete cascade,
  staff_id bigint not null references public.staff (id) on delete cascade,
  section_id bigint not null references public.sections (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (session_id, section_id, subject_id)
);
create index teacher_assignments_staff_idx on public.teacher_assignments (staff_id, session_id);

create trigger designations_updated_at before update on public.designations
  for each row execute function public.set_updated_at();
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger guardians_updated_at before update on public.guardians
  for each row execute function public.set_updated_at();
create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

alter table public.designations enable row level security;
alter table public.staff enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.enrollments enable row level security;
alter table public.teacher_assignments enable row level security;
