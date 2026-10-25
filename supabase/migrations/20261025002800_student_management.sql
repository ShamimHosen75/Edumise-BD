-- Step 3.4: student management.

-- Documents kept for a student (transfer certificate, old results, ...), private.
create table public.student_documents (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  label text not null check (length(label) between 1 and 120),
  file_path text not null check (file_path ~ '^students/[0-9]+/[a-f0-9-]+\.(pdf|jpg|png)$'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size integer not null check (file_size between 1 and 2097152),
  created_at timestamptz not null default now()
);
create index student_documents_student_idx on public.student_documents (student_id);

alter table public.student_documents enable row level security;
create policy "admins manage student documents" on public.student_documents
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- Lists and promotion read enrolments by session and student.
create index enrollments_session_idx on public.enrollments (session_id, section_id, roll);

/** Next student ID for a class level this year: YYYY + 2-digit class + 4-digit serial. */
create function app.next_student_code(p_level smallint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_prefix text := extract(year from (now() at time zone 'Asia/Dhaka'))::text || lpad(p_level::text, 2, '0');
  v_serial integer;
begin
  perform pg_advisory_xact_lock(hashtext('student_code:' || v_prefix));
  select coalesce(max(substring(s.student_code from 7)::integer), 0) + 1 into v_serial
  from public.students s
  where s.student_code like v_prefix || '%' and s.student_code ~ '^[0-9]{10}$';
  return v_prefix || lpad(v_serial::text, 4, '0');
end;
$$;
revoke execute on function app.next_student_code(smallint) from public, anon, authenticated;

/**
 * Imports students in one transaction: either every row is saved or none.
 * Rows (already validated by the app): name_en, name_bn, gender, birth_date, birth_reg_no,
 * religion, blood_group, section_id, roll (optional), guardian_name, guardian_phone, relation.
 * Guardians with the same mobile and name are reused. Returns the number imported.
 */
create function public.import_students(p_session_id bigint, p_rows jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  v_level smallint;
  v_student bigint;
  v_guardian bigint;
  v_roll smallint;
  v_count integer := 0;
begin
  if not app.is_admin() then
    raise exception 'only admins import students' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'rows must be a list of at most 2000' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select c.level into v_level from public.sections s join public.classes c on c.id = s.class_id
    where s.id = (r ->> 'section_id')::bigint;
    if v_level is null then
      raise exception 'unknown section' using errcode = '23503';
    end if;
    insert into public.students (
      student_code, full_name_en, full_name_bn, gender, religion, blood_group, status,
      admitted_on, birth_date, birth_reg_no
    ) values (
      app.next_student_code(v_level), r ->> 'name_en', coalesce(r ->> 'name_bn', ''),
      (r ->> 'gender')::public.gender, nullif(r ->> 'religion', '')::public.religion,
      nullif(r ->> 'blood_group', '')::public.blood_group, 'active',
      (now() at time zone 'Asia/Dhaka')::date, nullif(r ->> 'birth_date', '')::date,
      nullif(r ->> 'birth_reg_no', '')
    ) returning id into v_student;

    select g.id into v_guardian from public.guardians g
    where g.phone = r ->> 'guardian_phone' and lower(g.full_name_en) = lower(r ->> 'guardian_name')
    limit 1;
    if v_guardian is null then
      insert into public.guardians (full_name_en, phone)
      values (r ->> 'guardian_name', r ->> 'guardian_phone') returning id into v_guardian;
    end if;
    insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
    values (v_student, v_guardian, r ->> 'relation', true);

    perform pg_advisory_xact_lock(hashtext('roll:' || p_session_id || ':' || (r ->> 'section_id')));
    v_roll := nullif(r ->> 'roll', '')::smallint;
    if v_roll is null then
      select coalesce(max(e.roll), 0) + 1 into v_roll from public.enrollments e
      where e.session_id = p_session_id and e.section_id = (r ->> 'section_id')::bigint;
    end if;
    insert into public.enrollments (student_id, session_id, section_id, roll)
    values (v_student, p_session_id, (r ->> 'section_id')::bigint, v_roll);
    v_count := v_count + 1;
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'students.imported', 'academic_session', p_session_id::text,
    jsonb_build_object('count', v_count));
  return v_count;
end;
$$;
revoke execute on function public.import_students(bigint, jsonb) from public, anon;
grant execute on function public.import_students(bigint, jsonb) to authenticated;

/** The class's students in a session, with the promotion decision for each. */
create function app.promotion_rows(p_from_session bigint, p_class_id bigint, p_decisions jsonb)
returns table (student_id bigint, roll smallint, group_id bigint, section_name text, promote boolean)
language sql stable security definer set search_path = ''
as $$
  select e.student_id, e.roll, e.group_id, s.name_en,
         coalesce((d ->> 'promote')::boolean, false)
  from public.enrollments e
  join public.sections s on s.id = e.section_id
  join jsonb_array_elements(p_decisions) d on (d ->> 'student_id')::bigint = e.student_id
  where e.session_id = p_from_session and s.class_id = p_class_id;
$$;
revoke execute on function app.promotion_rows(bigint, bigint, jsonb) from public, anon, authenticated;

/**
 * Year-end promotion for one class, in one transaction. p_decisions: [{student_id, promote}].
 * Promoted students move to the next class (same section name, e.g. 6 A -> 7 A); retained
 * students stay in the class. New rolls follow the previous rolls (1, 2, 3 ... per section).
 * Class 10 students who are promoted are marked graduated (no new enrolment).
 * Returns the number of new enrolments.
 */
create function public.promote_students(
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
revoke execute on function public.promote_students(bigint, bigint, bigint, jsonb) from public, anon;
grant execute on function public.promote_students(bigint, bigint, bigint, jsonb) to authenticated;

/**
 * Adds one student from the office form and enrols them in a section in one transaction.
 * p_student (validated by the app): full_name_en, full_name_bn, gender, religion,
 * blood_group, status, admitted_on, birth_date, birth_reg_no, address, personal_phone.
 * Empty roll = next roll in the section. Returns the new id, student ID and roll.
 */
create function public.add_student(
  p_student jsonb, p_session_id bigint, p_section_id bigint, p_group_id bigint, p_roll smallint
)
returns table (student_id bigint, student_code text, roll smallint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_level smallint;
  v_code text;
  v_student bigint;
  v_roll smallint := p_roll;
begin
  if not app.is_admin() then
    raise exception 'only admins add students' using errcode = '42501';
  end if;
  select c.level into v_level from public.sections s join public.classes c on c.id = s.class_id
  where s.id = p_section_id;
  if v_level is null then
    raise exception 'unknown section' using errcode = '23503';
  end if;
  v_code := app.next_student_code(v_level);
  insert into public.students (
    student_code, full_name_en, full_name_bn, gender, religion, blood_group, status,
    admitted_on, birth_date, birth_reg_no, address, personal_phone
  ) values (
    v_code, p_student ->> 'full_name_en', coalesce(p_student ->> 'full_name_bn', ''),
    (p_student ->> 'gender')::public.gender, nullif(p_student ->> 'religion', '')::public.religion,
    nullif(p_student ->> 'blood_group', '')::public.blood_group,
    coalesce(nullif(p_student ->> 'status', ''), 'active')::public.student_status,
    coalesce(nullif(p_student ->> 'admitted_on', '')::date, (now() at time zone 'Asia/Dhaka')::date),
    nullif(p_student ->> 'birth_date', '')::date, nullif(p_student ->> 'birth_reg_no', ''),
    nullif(p_student ->> 'address', ''), nullif(p_student ->> 'personal_phone', '')
  ) returning id into v_student;

  perform pg_advisory_xact_lock(hashtext('roll:' || p_session_id || ':' || p_section_id));
  if v_roll is null then
    select coalesce(max(e.roll), 0) + 1 into v_roll from public.enrollments e
    where e.session_id = p_session_id and e.section_id = p_section_id;
  end if;
  insert into public.enrollments (student_id, session_id, section_id, group_id, roll)
  values (v_student, p_session_id, p_section_id, p_group_id, v_roll);

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'student.added', 'student', v_student::text,
    jsonb_build_object('student_code', v_code, 'section_id', p_section_id, 'roll', v_roll));
  return query select v_student, v_code, v_roll;
end;
$$;
revoke execute on function public.add_student(jsonb, bigint, bigint, bigint, smallint) from public, anon;
grant execute on function public.add_student(jsonb, bigint, bigint, bigint, smallint) to authenticated;
