-- Step 1.3 / 2: role helpers used by RLS policies, the JWT hook, and profile protection.
-- Helpers live in the "app" schema, which is not exposed through the REST API.

create schema app;
grant usage on schema app to anon, authenticated, service_role;

-- Current user's role (NULL when logged out, inactive, or no role assigned).
create function app.auth_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create function app.has_role(variadic roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(app.auth_role() = any (roles), false);
$$;

create function app.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role('super_admin', 'admin');
$$;

create function app.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role('super_admin', 'admin', 'teacher', 'accountant');
$$;

create function app.current_session_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.academic_sessions where is_current;
$$;

create function app.my_staff_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.staff where profile_id = auth.uid();
$$;

create function app.my_student_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.students where profile_id = auth.uid();
$$;

create function app.guardian_student_ids()
returns bigint[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(sg.student_id), '{}')
  from public.student_guardians sg
  join public.guardians g on g.id = sg.guardian_id
  where g.profile_id = auth.uid();
$$;

-- Sections a teacher teaches a subject in, or is class teacher of, in the current session.
create function app.teacher_section_ids()
returns bigint[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct section_id), '{}')
  from (
    select ta.section_id from public.teacher_assignments ta
    where ta.staff_id = app.my_staff_id() and ta.session_id = app.current_session_id()
    union
    select s.id from public.sections s where s.class_teacher_id = app.my_staff_id()
  ) t;
$$;

create function app.teacher_student_ids()
returns bigint[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(e.student_id), '{}')
  from public.enrollments e
  where e.session_id = app.current_session_id()
    and e.section_id = any (app.teacher_section_ids());
$$;

-- Classes of the logged-in student, or of a guardian's children (current session).
create function app.my_class_ids()
returns bigint[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct s.class_id), '{}')
  from public.enrollments e
  join public.sections s on s.id = e.section_id
  where e.session_id = app.current_session_id()
    and (e.student_id = app.my_student_id() or e.student_id = any (app.guardian_student_ids()));
$$;

-- True when the logged-in teacher is assigned this exam subject for this student's section.
create function app.teacher_teaches(p_exam_subject_id bigint, p_student_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.exam_subjects es
    join public.exams ex on ex.id = es.exam_id
    join public.teacher_assignments ta
      on ta.subject_id = es.subject_id and ta.session_id = ex.session_id
    join public.enrollments en
      on en.section_id = ta.section_id and en.session_id = ex.session_id
    where es.id = p_exam_subject_id
      and en.student_id = p_student_id
      and ta.staff_id = app.my_staff_id()
  );
$$;

-- Teachers may write marks only for their own subjects, and only until the subject is locked.
create function app.teacher_can_mark(p_exam_subject_id bigint, p_student_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role('teacher')
    and app.teacher_teaches(p_exam_subject_id, p_student_id)
    and not coalesce((select locked from public.exam_subjects where id = p_exam_subject_id), true);
$$;

revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- Profile protection: users may edit their own name/avatar and clear must_change_password,
-- but only admins change role, active status, email or phone; only a super_admin can
-- create or change a super_admin. Trusted server code (no auth.uid()) is not restricted.
create function app.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not app.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email or new.phone is distinct from old.phone then
      raise exception 'Only an admin can change role, status, email or phone' using errcode = '42501';
    end if;
  elsif not app.has_role('super_admin')
        and (old.role = 'super_admin' or new.role = 'super_admin') then
    raise exception 'Only a super admin can change a super admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function app.protect_profile();

-- Custom access token hook: adds app_role to the JWT so middleware can read it without
-- a query. RLS still reads the role from profiles, so a stale token never grants access.
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_role public.app_role;
  v_claims jsonb := event -> 'claims';
begin
  select role into v_role from public.profiles
  where id = (event ->> 'user_id')::uuid and is_active;

  v_claims := jsonb_set(v_claims, '{app_role}', coalesce(to_jsonb(v_role::text), 'null'::jsonb));
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant select on table public.profiles to supabase_auth_admin;
