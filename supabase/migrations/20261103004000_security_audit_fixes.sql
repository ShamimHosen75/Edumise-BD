-- Step 6.2 security audit fixes (docs/security-report.md). Applied migrations are not
-- edited; functions and policies are replaced here.

-- D1: a switched-off login (or one whose role changed) no longer reaches anyone's data.
-- The "own data" helpers used by the student, guardian and staff policies now require an
-- active profile with the matching role, as has_role() already does.
create or replace function app.my_student_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select s.id from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid() and p.is_active and p.role = 'student';
$$;

create or replace function app.guardian_student_ids()
returns bigint[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(sg.student_id), '{}')
  from public.student_guardians sg
  join public.guardians g on g.id = sg.guardian_id
  join public.profiles p on p.id = g.profile_id
  where g.profile_id = auth.uid() and p.is_active and p.role = 'guardian';
$$;

create or replace function app.my_staff_id()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select st.id from public.staff st
  join public.profiles p on p.id = st.profile_id
  where st.profile_id = auth.uid() and p.is_active
    and p.role in ('super_admin', 'admin', 'teacher', 'accountant');
$$;

-- D2: a teacher sees attendance and results of their sections for this session's
-- students only, not earlier years' classes that used the same section.
drop policy "attendance visible to admins, section teachers, student and guardians" on public.attendance;
create policy "attendance visible to admins, section teachers, student and guardians"
  on public.attendance for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher'))
        and section_id = any ((select app.teacher_section_ids())::bigint[])
        and student_id = any ((select app.teacher_student_ids())::bigint[]))
    or student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[])
  );

drop policy "results visible to admins, class teachers, section teachers once published" on public.results;
create policy "results visible to admins, class teachers, section teachers once published"
  on public.results for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher'))
        and exists (select 1 from public.exams e
                    where e.id = results.exam_id and e.session_id = (select app.current_session_id()))
        and (exists (select 1 from public.sections s
                     where s.id = results.section_id and s.class_teacher_id = (select app.my_staff_id()))
             or (section_id = any ((select app.teacher_section_ids())::bigint[])
                 and exists (select 1 from public.exams e
                             where e.id = results.exam_id and e.status = 'published'))))
    or ((student_id = (select app.my_student_id())
         or student_id = any ((select app.guardian_student_ids())::bigint[]))
        and exists (select 1 from public.exams e
                    where e.id = results.exam_id and e.status = 'published'))
  );

-- D3: only an admin changes a person's name or photo (receipts print the receiver's name).
create or replace function app.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not app.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email or new.phone is distinct from old.phone
       or new.must_change_password is distinct from old.must_change_password
       or new.full_name_en is distinct from old.full_name_en
       or new.full_name_bn is distinct from old.full_name_bn
       or new.avatar_path is distinct from old.avatar_path then
      raise exception 'Only an admin can change a profile''s name, photo, role, status, email, phone or password flags'
        using errcode = '42501';
    end if;
  elsif not app.has_role('super_admin')
        and (old.role = 'super_admin' or new.role = 'super_admin') then
    raise exception 'Only a super admin can change a super admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- D5: API roles never need TRUNCATE (which ignores RLS), REFERENCES or TRIGGER.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
