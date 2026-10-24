-- Step 1.3 / 3: policies for profiles and people.
-- Function calls are wrapped in (select ...) so Postgres evaluates them once per query.

-- profiles ------------------------------------------------------------------
create policy "users read own profile, admins read all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select app.is_admin()));

create policy "users update own profile, admins update all" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select app.is_admin()))
  with check (id = (select auth.uid()) or (select app.is_admin()));

create policy "super admins delete profiles" on public.profiles
  for delete to authenticated
  using ((select app.has_role('super_admin')));

create policy "auth server reads profiles for the token hook" on public.profiles
  for select to supabase_auth_admin
  using (true);

-- staff (public fields only; private fields are in staff_private) ---------------
create policy "anyone reads public staff" on public.staff
  for select to anon, authenticated
  using (is_public);

create policy "staff read own record" on public.staff
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "admins manage staff" on public.staff
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "admins and the staff member read private fields" on public.staff_private
  for select to authenticated
  using ((select app.is_admin()) or staff_id = (select app.my_staff_id()));

create policy "admins manage private fields" on public.staff_private
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- students ------------------------------------------------------------------
create policy "students visible to admins, accountants, their teachers, themselves and guardians"
  on public.students for select to authenticated
  using (
    (select app.has_role('super_admin', 'admin', 'accountant'))
    or ((select app.has_role('teacher')) and id = any ((select app.teacher_student_ids())::bigint[]))
    or id = (select app.my_student_id())
    or id = any ((select app.guardian_student_ids())::bigint[])
  );

create policy "admins manage students" on public.students
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- guardians -----------------------------------------------------------------
create policy "guardians visible to admins, accountants, linked teachers, students and themselves"
  on public.guardians for select to authenticated
  using (
    (select app.has_role('super_admin', 'admin', 'accountant'))
    or profile_id = (select auth.uid())
    or exists (
      select 1 from public.student_guardians sg
      where sg.guardian_id = guardians.id
        and (sg.student_id = (select app.my_student_id())
             or ((select app.has_role('teacher')) and sg.student_id = any ((select app.teacher_student_ids())::bigint[])))
    )
  );

create policy "admins manage guardians" on public.guardians
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "guardian links visible to the same people as the student"
  on public.student_guardians for select to authenticated
  using (
    (select app.has_role('super_admin', 'admin', 'accountant'))
    or ((select app.has_role('teacher')) and student_id = any ((select app.teacher_student_ids())::bigint[]))
    or student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[])
  );

create policy "admins manage guardian links" on public.student_guardians
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- enrollments ---------------------------------------------------------------
create policy "enrolments visible to admins, accountants, section teachers, student and guardians"
  on public.enrollments for select to authenticated
  using (
    (select app.has_role('super_admin', 'admin', 'accountant'))
    or ((select app.has_role('teacher')) and section_id = any ((select app.teacher_section_ids())::bigint[]))
    or student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[])
  );

create policy "admins manage enrolments" on public.enrollments
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- teacher_assignments -------------------------------------------------------
create policy "assignments visible to admins and the teacher" on public.teacher_assignments
  for select to authenticated
  using ((select app.is_admin()) or staff_id = (select app.my_staff_id()));

create policy "admins manage assignments" on public.teacher_assignments
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
