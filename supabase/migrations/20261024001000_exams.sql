-- Step 1.2 / 10: exams, subjects per exam and class, and marks.
-- An exam's results are public once status = 'published'.

create table public.exams (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.academic_sessions (id) on delete restrict,
  name_en text not null,
  name_bn text not null default '',
  starts_on date,
  ends_on date,
  status public.exam_status not null default 'draft',
  schedule_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (status <> 'published' or published_at is not null)
);

create table public.exam_classes (
  exam_id bigint not null references public.exams (id) on delete cascade,
  class_id bigint not null references public.classes (id) on delete cascade,
  primary key (exam_id, class_id)
);

-- Part marks: CQ (creative), MCQ, practical. A part with full = 0 is not used.
create table public.exam_subjects (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.exams (id) on delete cascade,
  class_id bigint not null references public.classes (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete restrict,
  cq_full smallint not null default 0 check (cq_full >= 0),
  cq_pass smallint check (cq_pass >= 0),
  mcq_full smallint not null default 0 check (mcq_full >= 0),
  mcq_pass smallint check (mcq_pass >= 0),
  practical_full smallint not null default 0 check (practical_full >= 0),
  practical_pass smallint check (practical_pass >= 0),
  full_marks smallint generated always as (cq_full + mcq_full + practical_full) stored,
  counts_in_gpa boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, class_id, subject_id),
  check (cq_full + mcq_full + practical_full > 0),
  check (cq_pass is null or cq_pass <= cq_full),
  check (mcq_pass is null or mcq_pass <= mcq_full),
  check (practical_pass is null or practical_pass <= practical_full)
);

create table public.marks (
  id bigint generated always as identity primary key,
  exam_subject_id bigint not null references public.exam_subjects (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  cq numeric(5, 2) check (cq >= 0),
  mcq numeric(5, 2) check (mcq >= 0),
  practical numeric(5, 2) check (practical >= 0),
  is_absent boolean not null default false,
  entered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_subject_id, student_id),
  check (not is_absent or (cq is null and mcq is null and practical is null))
);
create index marks_student_idx on public.marks (student_id);

-- Each part must be within its full marks; unused parts must stay empty.
create function public.check_marks_within_full()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  es public.exam_subjects%rowtype;
begin
  select * into es from public.exam_subjects where id = new.exam_subject_id;
  if (new.cq is not null and new.cq > es.cq_full)
     or (new.mcq is not null and new.mcq > es.mcq_full)
     or (new.practical is not null and new.practical > es.practical_full) then
    raise exception 'Marks exceed full marks for this part' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger marks_within_full before insert or update on public.marks
  for each row execute function public.check_marks_within_full();

create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();
create trigger exam_subjects_updated_at before update on public.exam_subjects
  for each row execute function public.set_updated_at();
create trigger marks_updated_at before update on public.marks
  for each row execute function public.set_updated_at();

alter table public.exams enable row level security;
alter table public.exam_classes enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.marks enable row level security;
