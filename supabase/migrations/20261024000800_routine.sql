-- Step 1.2 / 8: periods, rooms and the weekly class routine.

create table public.periods (
  id bigint generated always as identity primary key,
  number smallint not null unique check (number > 0),
  starts_at time not null,
  ends_at time not null,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.rooms (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.routine (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.academic_sessions (id) on delete cascade,
  section_id bigint not null references public.sections (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  period_id bigint not null references public.periods (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete restrict,
  staff_id bigint references public.staff (id) on delete set null,
  room_id bigint references public.rooms (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, section_id, day_of_week, period_id)
);
-- Database backstop for clashes (Step 3.5 shows them in the UI first):
-- a teacher or a room cannot be in two places in the same period.
create unique index routine_teacher_clash on public.routine (session_id, day_of_week, period_id, staff_id)
  where staff_id is not null;
create unique index routine_room_clash on public.routine (session_id, day_of_week, period_id, room_id)
  where room_id is not null;

create trigger routine_updated_at before update on public.routine
  for each row execute function public.set_updated_at();

alter table public.periods enable row level security;
alter table public.rooms enable row level security;
alter table public.routine enable row level security;
