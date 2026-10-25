-- Step 3.3: online admission.

create type public.admission_status as enum (
  'submitted', 'under_review', 'test_scheduled', 'approved', 'rejected', 'waitlisted'
);

create table public.admission_applications (
  id bigint generated always as identity primary key,
  tracking_no text not null unique check (tracking_no ~ '^ADM-[0-9]{4}-[0-9]{5,}$'),
  session_id bigint not null references public.academic_sessions (id) on delete restrict,
  class_id bigint not null references public.classes (id) on delete restrict,
  group_id bigint references public.groups (id) on delete restrict,
  status public.admission_status not null default 'submitted',
  -- Student
  student_name_en text not null check (length(student_name_en) between 1 and 100),
  student_name_bn text not null default '',
  birth_date date not null,
  gender public.gender not null,
  birth_reg_no text not null check (birth_reg_no ~ '^[0-9]{17}$'),
  religion public.religion,
  blood_group public.blood_group,
  photo_path text,
  -- Guardians
  father_name text not null check (length(father_name) between 1 and 100),
  mother_name text not null check (length(mother_name) between 1 and 100),
  local_guardian_name text not null default '',
  guardian_phone text not null check (public.is_bd_phone(guardian_phone)),
  guardian_occupation text not null default '',
  guardian_email text,
  present_address text not null check (length(present_address) between 1 and 300),
  permanent_address text not null default '',
  -- Academic
  previous_school text not null default '',
  last_result text not null default '',
  -- Review (office only)
  test_at timestamptz,
  test_venue text not null default '',
  test_marks numeric(5, 2) check (test_marks between 0 and 100),
  office_note text not null default '',
  student_id bigint references public.students (id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admission_applications_queue_idx
  on public.admission_applications (class_id, status, submitted_at desc);
create index admission_applications_lookup_idx
  on public.admission_applications (tracking_no, guardian_phone);

create trigger admission_applications_updated_at before update on public.admission_applications
  for each row execute function public.set_updated_at();

create table public.admission_documents (
  id bigint generated always as identity primary key,
  application_id bigint not null references public.admission_applications (id) on delete cascade,
  kind text not null check (kind in ('birth_certificate', 'transcript')),
  file_path text not null check (file_path ~ '^admissions/[0-9]+/[a-f0-9-]+\.(pdf|jpg|png)$'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size integer not null check (file_size between 1 and 2097152),
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

-- One counter per year for tracking numbers (ADM-2026-00001).
create table public.tracking_counters (
  year smallint primary key,
  last_value integer not null default 0
);

-- Who did what, for the office's records.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);

alter table public.admission_applications enable row level security;
alter table public.admission_documents enable row level security;
alter table public.tracking_counters enable row level security;
alter table public.audit_log enable row level security;

-- Applicants never read or write these tables directly: the server writes new
-- applications with the service role after validating them, and answers status
-- questions itself. Admins work the queue.
create policy "admins read applications" on public.admission_applications
  for select to authenticated using ((select app.is_admin()));
create policy "admins update applications" on public.admission_applications
  for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy "admins read application documents" on public.admission_documents
  for select to authenticated using ((select app.is_admin()));
create policy "admins read the audit log" on public.audit_log
  for select to authenticated using ((select app.is_admin()));
-- tracking_counters: written only by next_tracking_no(); admins may read it.
create policy "admins read tracking counters" on public.tracking_counters
  for select to authenticated using ((select app.is_admin()));

/** Next tracking number for this year, e.g. ADM-2026-00001 (server only). */
create function public.next_tracking_no()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_year smallint := extract(year from (now() at time zone 'Asia/Dhaka'))::smallint;
  v_value integer;
begin
  insert into public.tracking_counters (year, last_value) values (v_year, 1)
  on conflict (year) do update set last_value = public.tracking_counters.last_value + 1
  returning last_value into v_value;
  return 'ADM-' || v_year || '-' || lpad(v_value::text, 5, '0');
end;
$$;
revoke execute on function public.next_tracking_no() from public, anon, authenticated;
grant execute on function public.next_tracking_no() to service_role;

/** Records an action by the signed-in admin. */
create function public.record_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admins write the audit log' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'));
end;
$$;
revoke execute on function public.record_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.record_audit(text, text, text, jsonb) to authenticated;

/**
 * Approves an application in one transaction: creates the student (ID year + class +
 * serial), links or creates the guardians, enrolls the student in the chosen section with
 * the next roll, marks the application approved and writes the audit log.
 * Returns the student id, enrollment roll, student code and the primary guardian id.
 */
create function public.approve_admission(p_application_id bigint, p_section_id bigint)
returns table (student_id bigint, student_code text, roll smallint, guardian_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  a public.admission_applications;
  v_level smallint;
  v_section_class bigint;
  v_prefix text;
  v_serial integer;
  v_student bigint;
  v_code text;
  v_roll smallint;
  v_father bigint;
  v_mother bigint;
  v_local bigint;
  v_primary bigint;
  v_year text := extract(year from (now() at time zone 'Asia/Dhaka'))::text;
begin
  if not app.is_admin() then
    raise exception 'only admins approve admissions' using errcode = '42501';
  end if;

  select * into a from public.admission_applications where id = p_application_id for update;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if a.status = 'approved' then
    raise exception 'application already approved' using errcode = '23505';
  end if;
  select class_id into v_section_class from public.sections where id = p_section_id;
  if v_section_class is distinct from a.class_id then
    raise exception 'section is not in the applied class' using errcode = '23514';
  end if;
  select level into v_level from public.classes where id = a.class_id;

  -- Student ID: year + 2-digit class + 4-digit serial, unique for life.
  v_prefix := v_year || lpad(v_level::text, 2, '0');
  perform pg_advisory_xact_lock(hashtext('student_code:' || v_prefix));
  select coalesce(max(substring(s.student_code from 7)::integer), 0) + 1 into v_serial
  from public.students s
  where s.student_code like v_prefix || '%' and s.student_code ~ '^[0-9]{10}$';
  v_code := v_prefix || lpad(v_serial::text, 4, '0');

  insert into public.students (
    student_code, full_name_en, full_name_bn, gender, religion, blood_group, photo_path,
    status, admitted_on, birth_date, birth_reg_no, address
  ) values (
    v_code, a.student_name_en, a.student_name_bn, a.gender, a.religion, a.blood_group,
    a.photo_path, 'active', (now() at time zone 'Asia/Dhaka')::date, a.birth_date,
    a.birth_reg_no, a.present_address
  ) returning id into v_student;

  -- Guardians: reuse a guardian with the same phone and name (brothers and sisters).
  select g.id into v_father from public.guardians g
  where g.phone = a.guardian_phone and lower(g.full_name_en) = lower(a.father_name) limit 1;
  if v_father is null then
    insert into public.guardians (full_name_en, phone, email, occupation, address)
    values (a.father_name, a.guardian_phone, a.guardian_email, a.guardian_occupation, a.present_address)
    returning id into v_father;
  end if;
  select g.id into v_mother from public.guardians g
  where g.phone = a.guardian_phone and lower(g.full_name_en) = lower(a.mother_name) limit 1;
  if v_mother is null then
    insert into public.guardians (full_name_en, phone, address)
    values (a.mother_name, a.guardian_phone, a.present_address)
    returning id into v_mother;
  end if;
  v_primary := v_father;
  if a.local_guardian_name <> '' then
    select g.id into v_local from public.guardians g
    where g.phone = a.guardian_phone and lower(g.full_name_en) = lower(a.local_guardian_name) limit 1;
    if v_local is null then
      insert into public.guardians (full_name_en, phone, email, occupation, address)
      values (a.local_guardian_name, a.guardian_phone, a.guardian_email, a.guardian_occupation, a.present_address)
      returning id into v_local;
    end if;
    v_primary := v_local;
  end if;
  insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
  values (v_student, v_father, 'father', v_primary = v_father),
         (v_student, v_mother, 'mother', false);
  if v_local is not null then
    insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
    values (v_student, v_local, 'other', true);
  end if;

  -- Next roll in the section for the application's session.
  perform pg_advisory_xact_lock(hashtext('roll:' || a.session_id || ':' || p_section_id));
  select coalesce(max(e.roll), 0) + 1 into v_roll from public.enrollments e
  where e.session_id = a.session_id and e.section_id = p_section_id;
  insert into public.enrollments (student_id, session_id, section_id, group_id, roll)
  values (v_student, a.session_id, p_section_id, a.group_id, v_roll);

  update public.admission_applications
  set status = 'approved', student_id = v_student
  where id = p_application_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'admission.approved', 'admission_application', p_application_id::text,
    jsonb_build_object('student_id', v_student, 'student_code', v_code,
      'section_id', p_section_id, 'roll', v_roll, 'guardian_id', v_primary));

  return query select v_student, v_code, v_roll, v_primary;
end;
$$;
revoke execute on function public.approve_admission(bigint, bigint) from public, anon;
grant execute on function public.approve_admission(bigint, bigint) to authenticated;
