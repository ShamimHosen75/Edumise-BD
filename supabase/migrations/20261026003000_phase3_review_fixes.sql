-- Phase 3 code review fixes (see docs/code-review-phase-3.md).

-- Student IDs are never reused: one counter per year + class prefix (the old rule,
-- highest + 1, gave a deleted student's ID to the next one).
create table public.student_code_counters (
  prefix text primary key check (prefix ~ '^[0-9]{6}$'),
  last_value integer not null check (last_value between 0 and 9999)
);
alter table public.student_code_counters enable row level security;
create policy "admins read student code counters" on public.student_code_counters
  for select to authenticated using ((select app.is_admin()));

create or replace function app.next_student_code(p_level smallint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_prefix text := extract(year from (now() at time zone 'Asia/Dhaka'))::text || lpad(p_level::text, 2, '0');
  v_serial integer;
begin
  perform pg_advisory_xact_lock(hashtext('student_code:' || v_prefix));
  -- The first time a prefix is used, continue after the IDs already given.
  insert into public.student_code_counters (prefix, last_value)
  select v_prefix, coalesce(max(substring(s.student_code from 7)::integer), 0)
  from public.students s
  where s.student_code like v_prefix || '%' and s.student_code ~ '^[0-9]{10}$'
  on conflict (prefix) do nothing;
  update public.student_code_counters set last_value = last_value + 1
  where prefix = v_prefix and last_value < 9999
  returning last_value into v_serial;
  if v_serial is null then
    raise exception 'no student IDs left for %', v_prefix using errcode = '22003';
  end if;
  return v_prefix || lpad(v_serial::text, 4, '0');
end;
$$;
revoke execute on function app.next_student_code(smallint) from public, anon, authenticated;

-- One main contact per student, changed in one step.
create unique index student_guardians_one_primary on public.student_guardians (student_id)
  where is_primary;

create function public.set_primary_guardian(p_student_id bigint, p_guardian_id bigint)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admins change guardians' using errcode = '42501';
  end if;
  if not exists (select 1 from public.student_guardians
                 where student_id = p_student_id and guardian_id = p_guardian_id) then
    return false;
  end if;
  update public.student_guardians set is_primary = false
  where student_id = p_student_id and is_primary and guardian_id <> p_guardian_id;
  update public.student_guardians set is_primary = true
  where student_id = p_student_id and guardian_id = p_guardian_id;
  return true;
end;
$$;
revoke execute on function public.set_primary_guardian(bigint, bigint) from public, anon;
grant execute on function public.set_primary_guardian(bigint, bigint) to authenticated;

-- A week can hold up to 20 periods x 7 days.
create or replace function public.save_section_routine(p_session_id bigint, p_section_id bigint, p_cells jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'only admins edit the routine' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 140 then
    raise exception 'cells must be a list of at most 140' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_cells) c
             join public.periods p on p.id = (c ->> 'period_id')::bigint
             where p.is_break) then
    raise exception 'no class in a break' using errcode = '22023';
  end if;

  delete from public.routine where session_id = p_session_id and section_id = p_section_id;
  insert into public.routine (session_id, section_id, day_of_week, period_id, subject_id, staff_id, room_id)
  select p_session_id, p_section_id, (c ->> 'day_of_week')::smallint, (c ->> 'period_id')::bigint,
         (c ->> 'subject_id')::bigint, nullif(c ->> 'staff_id', '')::bigint, nullif(c ->> 'room_id', '')::bigint
  from jsonb_array_elements(p_cells) c;
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'routine.saved', 'section', p_section_id::text,
    jsonb_build_object('session_id', p_session_id, 'cells', v_count));
  return v_count;
end;
$$;

-- Indexes for the admission queue (newest first) and a teacher's routine; the
-- enrolment index from Step 3.4 repeats the unique (session, section, roll) index.
create index admission_applications_submitted_idx
  on public.admission_applications (submitted_at desc);
create index routine_staff_idx on public.routine (staff_id, session_id);
drop index public.enrollments_session_idx;

create or replace function public.approve_admission(p_application_id bigint, p_section_id bigint)
returns table (student_id bigint, student_code text, roll smallint, guardian_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  a public.admission_applications;
  v_level smallint;
  v_section_class bigint;
  v_student bigint;
  v_code text;
  v_roll smallint;
  v_father bigint;
  v_mother bigint;
  v_local bigint;
  v_primary bigint;
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

  -- Student ID: year + 2-digit class + 4-digit serial, unique for life (never reused).
  v_code := app.next_student_code(v_level);

  insert into public.students (
    student_code, full_name_en, full_name_bn, gender, religion, blood_group, photo_path,
    status, admitted_on, birth_date, birth_reg_no, address
  ) values (
    v_code, a.student_name_en, a.student_name_bn, a.gender, a.religion, a.blood_group,
    a.photo_path, 'active', (now() at time zone 'Asia/Dhaka')::date, a.birth_date,
    a.birth_reg_no, a.present_address
  ) returning id into v_student;

  -- Guardians: always new records. Matching an existing guardian by mobile and name
  -- would let anyone who knows a parent's mobile join that family (Phase 3 review); the
  -- office links existing guardians on the student's Guardians tab instead.
  insert into public.guardians (full_name_en, phone, email, occupation, address)
  values (a.father_name, a.guardian_phone, a.guardian_email, a.guardian_occupation, a.present_address)
  returning id into v_father;
  insert into public.guardians (full_name_en, phone, address)
  values (a.mother_name, a.guardian_phone, a.present_address)
  returning id into v_mother;
  v_primary := v_father;
  -- The local guardian is often the father or mother: then that record is the main one.
  if lower(trim(a.local_guardian_name)) = lower(trim(a.father_name)) then
    v_primary := v_father;
  elsif lower(trim(a.local_guardian_name)) = lower(trim(a.mother_name)) then
    v_primary := v_mother;
  elsif trim(a.local_guardian_name) <> '' then
    insert into public.guardians (full_name_en, phone, email, occupation, address)
    values (a.local_guardian_name, a.guardian_phone, a.guardian_email, a.guardian_occupation, a.present_address)
    returning id into v_local;
    v_primary := v_local;
  end if;
  insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
  values (v_student, v_father, 'father', v_primary = v_father),
         (v_student, v_mother, 'mother', v_primary = v_mother);
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
create or replace function public.promote_students(
  p_from_session bigint, p_to_session bigint, p_class_id bigint, p_decisions jsonb
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_level smallint;
  v_next_class bigint;
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'only admins promote students' using errcode = '42501';
  end if;
  if p_from_session = p_to_session then
    raise exception 'choose a different session to promote into' using errcode = '22023';
  end if;
  select level into v_level from public.classes where id = p_class_id;
  select id into v_next_class from public.classes where level = v_level + 1;

  -- Promote into a later year only.
  if (select starts_on from public.academic_sessions where id = p_to_session)
     <= (select starts_on from public.academic_sessions where id = p_from_session) then
    raise exception 'promote into a later session' using errcode = '22023';
  end if;
  -- Every student needs a section with the same name in the class they go to; otherwise
  -- they would be left out without a word (Phase 3 review).
  if exists (
    select 1 from app.promotion_rows(p_from_session, p_class_id, p_decisions) p
    where not (p.promote and v_next_class is null)
      and not exists (
        select 1 from public.sections s
        where s.class_id = case when p.promote then v_next_class else p_class_id end
          and lower(s.name_en) = lower(p.section_name))
  ) then
    raise exception 'a section is missing in the next class' using errcode = '23503';
  end if;

  if exists (select 1 from app.promotion_rows(p_from_session, p_class_id, p_decisions) p
             join public.enrollments e
             on e.student_id = p.student_id and e.session_id = p_to_session) then
    raise exception 'some students are already enrolled in that session' using errcode = '23505';
  end if;

  -- Promoted from the last class: graduated.
  if v_next_class is null then
    update public.students set status = 'graduated'
    where id in (select p.student_id from app.promotion_rows(p_from_session, p_class_id, p_decisions) p
                 where p.promote);
  end if;

  insert into public.enrollments (student_id, session_id, section_id, group_id, roll)
  select p.student_id, p_to_session, target.id,
         case when target_level >= 9 then p.group_id end,
         (coalesce((select max(e.roll) from public.enrollments e
                    where e.session_id = p_to_session and e.section_id = target.id), 0)
          + row_number() over (partition by target.id order by p.roll))::smallint
  from app.promotion_rows(p_from_session, p_class_id, p_decisions) p
  cross join lateral (
    select s.id, c.level as target_level from public.sections s join public.classes c on c.id = s.class_id
    where s.class_id = case when p.promote then v_next_class else p_class_id end
      and lower(s.name_en) = lower(p.section_name)
  ) target
  where not (p.promote and v_next_class is null);
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'students.promoted', 'class', p_class_id::text,
    jsonb_build_object('from_session', p_from_session, 'to_session', p_to_session,
      'promoted', (select count(*) from app.promotion_rows(p_from_session, p_class_id, p_decisions) p where p.promote),
      'retained', (select count(*) from app.promotion_rows(p_from_session, p_class_id, p_decisions) p where not p.promote),
      'enrolled', v_count));
  return v_count;
end;
$$;
