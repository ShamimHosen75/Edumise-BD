-- Step 4.1: student attendance. Teachers mark their own sections for today and the
-- 3 calendar days before (open question 25); after that only admins can change it.
-- Nobody records a future date.

/** Today in Bangladesh. */
create function app.dhaka_today()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'Asia/Dhaka')::date;
$$;

drop policy "teachers mark attendance for their sections" on public.attendance;
drop policy "teachers update attendance for their sections" on public.attendance;
drop policy "admins manage attendance" on public.attendance;

create policy "teachers mark attendance for their sections" on public.attendance
  for insert to authenticated
  with check (
    (select app.has_role('teacher'))
    and date between (select app.dhaka_today()) - 3 and (select app.dhaka_today())
    and marked_by = (select auth.uid())
    and section_id = any ((select app.teacher_section_ids())::bigint[])
    and student_id = any ((select app.teacher_student_ids())::bigint[])
    and exists (select 1 from public.enrollments e
                where e.student_id = attendance.student_id and e.section_id = attendance.section_id
                  and e.session_id = (select app.current_session_id()))
  );

create policy "teachers update attendance for their sections" on public.attendance
  for update to authenticated
  using (
    (select app.has_role('teacher'))
    and section_id = any ((select app.teacher_section_ids())::bigint[])
    and date between (select app.dhaka_today()) - 3 and (select app.dhaka_today())
  )
  with check (
    (select app.has_role('teacher'))
    and date between (select app.dhaka_today()) - 3 and (select app.dhaka_today())
    and marked_by = (select auth.uid())
    and section_id = any ((select app.teacher_section_ids())::bigint[])
    and exists (select 1 from public.enrollments e
                where e.student_id = attendance.student_id and e.section_id = attendance.section_id
                  and e.session_id = (select app.current_session_id()))
  );

create policy "admins read attendance" on public.attendance
  for select to authenticated using ((select app.is_admin()));
create policy "admins delete attendance" on public.attendance
  for delete to authenticated using ((select app.is_admin()));
create policy "admins record attendance up to today" on public.attendance
  for insert to authenticated
  with check ((select app.is_admin()) and date <= (select app.dhaka_today()));
create policy "admins correct attendance up to today" on public.attendance
  for update to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()) and date <= (select app.dhaka_today()));

-- Today's attendance across all sections (admin home).
create index attendance_date_idx on public.attendance (date, section_id);
