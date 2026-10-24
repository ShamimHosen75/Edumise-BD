-- Step 1.3 / 5: policies for attendance, exams, marks and fees.

-- attendance ----------------------------------------------------------------
create policy "attendance visible to admins, section teachers, student and guardians"
  on public.attendance for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher')) and section_id = any ((select app.teacher_section_ids())::bigint[]))
    or student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[])
  );

-- Teachers write attendance only for their own sections, and only for students
-- enrolled in that section this session.
create policy "teachers mark attendance for their sections" on public.attendance
  for insert to authenticated
  with check (
    (select app.has_role('teacher'))
    and section_id = any ((select app.teacher_section_ids())::bigint[])
    and student_id = any ((select app.teacher_student_ids())::bigint[])
    and exists (select 1 from public.enrollments e
                where e.student_id = attendance.student_id and e.section_id = attendance.section_id
                  and e.session_id = (select app.current_session_id()))
  );

create policy "teachers update attendance for their sections" on public.attendance
  for update to authenticated
  using ((select app.has_role('teacher')) and section_id = any ((select app.teacher_section_ids())::bigint[]))
  with check (
    (select app.has_role('teacher'))
    and section_id = any ((select app.teacher_section_ids())::bigint[])
    and exists (select 1 from public.enrollments e
                where e.student_id = attendance.student_id and e.section_id = attendance.section_id
                  and e.session_id = (select app.current_session_id()))
  );

create policy "admins manage attendance" on public.attendance
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- exams ---------------------------------------------------------------------
-- Everyone sees published exams and published schedules; staff see all exams.
create policy "published exams are visible" on public.exams
  for select to anon, authenticated
  using (status = 'published' or schedule_published or (select app.is_staff()));
create policy "admins manage exams" on public.exams
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "exam classes follow their exam" on public.exam_classes
  for select to anon, authenticated
  using (exists (select 1 from public.exams e where e.id = exam_classes.exam_id));
create policy "admins manage exam classes" on public.exam_classes
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "exam subjects follow their exam" on public.exam_subjects
  for select to anon, authenticated
  using (exists (select 1 from public.exams e where e.id = exam_subjects.exam_id));
create policy "admins manage exam subjects" on public.exam_subjects
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- marks ---------------------------------------------------------------------
-- Not readable by anon: public result search (Step 4.3) returns one mark sheet through
-- a function, so nobody can list every student's marks.
create policy "marks visible to admins, subject teachers, and student/guardians once published"
  on public.marks for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher')) and app.teacher_teaches(exam_subject_id, student_id))
    or ((student_id = (select app.my_student_id()) or student_id = any ((select app.guardian_student_ids())::bigint[]))
        and exists (select 1 from public.exam_subjects es join public.exams e on e.id = es.exam_id
                    where es.id = marks.exam_subject_id and e.status = 'published'))
  );

create policy "teachers enter marks for their subjects until locked" on public.marks
  for insert to authenticated
  with check (app.teacher_can_mark(exam_subject_id, student_id));
create policy "teachers edit marks for their subjects until locked" on public.marks
  for update to authenticated
  using (app.teacher_can_mark(exam_subject_id, student_id))
  with check (app.teacher_can_mark(exam_subject_id, student_id));
create policy "teachers delete marks for their subjects until locked" on public.marks
  for delete to authenticated
  using (app.teacher_can_mark(exam_subject_id, student_id));

create policy "admins manage marks" on public.marks
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- fees: admins and accountants have full access; teachers see nothing ----------
do $$
declare
  t text;
begin
  foreach t in array array['fee_heads', 'fee_structures', 'fee_waivers', 'invoices', 'invoice_items'] loop
    execute format(
      'create policy "admins and accountants manage %1$s" on public.%1$I for all to authenticated '
      'using ((select app.has_role(''super_admin'', ''admin'', ''accountant''))) '
      'with check ((select app.has_role(''super_admin'', ''admin'', ''accountant'')))', t);
  end loop;
end;
$$;

-- Students and guardians read their own bills (and fee head names to show them).
create policy "students and guardians read fee heads" on public.fee_heads
  for select to authenticated
  using ((select app.has_role('student', 'guardian')));

do $$
declare
  t text;
begin
  foreach t in array array['fee_waivers', 'invoices', 'invoice_items'] loop
    execute format(
      'create policy "students and guardians read own %1$s" on public.%1$I for select to authenticated '
      'using (student_id = (select app.my_student_id()) '
      'or student_id = any ((select app.guardian_student_ids())::bigint[]))', t);
  end loop;
end;
$$;
