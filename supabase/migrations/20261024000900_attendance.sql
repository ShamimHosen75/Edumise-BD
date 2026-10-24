-- Step 1.2 / 9: daily student attendance (one row per student per day).

create table public.attendance (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  section_id bigint not null references public.sections (id) on delete cascade,
  date date not null,
  status public.attendance_status not null,
  note text not null default '',
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);
create index attendance_section_date_idx on public.attendance (section_id, date);

create trigger attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

alter table public.attendance enable row level security;
