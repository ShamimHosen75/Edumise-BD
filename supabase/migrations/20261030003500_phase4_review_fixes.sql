-- Phase 4 code review fixes (docs/code-review-phase-4.md). Applied migrations are not
-- edited; functions are replaced here.

-- C1/C2 (results): an exam's results are current only if nothing that feeds them changed
-- after processing. Instead of comparing updated_at columns (which miss deletes), every
-- change stamps the exams it affects.
alter table public.exams add column inputs_changed_at timestamptz;

create function app.touch_exams()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  -- The row after the change (before it, for a delete) and, for an update, the old row.
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
begin
  if tg_table_name = 'marks' then
    update public.exams e set inputs_changed_at = now()
    from public.exam_subjects es
    where es.id = (r ->> 'exam_subject_id')::bigint and e.id = es.exam_id;
  elsif tg_table_name = 'exam_subjects' then
    update public.exams set inputs_changed_at = now() where id = (r ->> 'exam_id')::bigint;
  elsif tg_table_name = 'enrollments' then
    update public.exams set inputs_changed_at = now()
    where session_id in ((r ->> 'session_id')::bigint, (o ->> 'session_id')::bigint);
  elsif tg_table_name = 'class_subjects' then
    update public.exams e set inputs_changed_at = now()
    from public.exam_classes ec
    where ec.exam_id = e.id
      and ec.class_id in ((r ->> 'class_id')::bigint, (o ->> 'class_id')::bigint);
  elsif tg_table_name = 'students' then
    update public.exams e set inputs_changed_at = now()
    from public.enrollments en
    where en.student_id = (r ->> 'id')::bigint and e.session_id = en.session_id;
  elsif tg_table_name = 'school_settings' then
    update public.exams set inputs_changed_at = now() where status <> 'published';
  end if;
  return null;
end;
$$;

create trigger marks_touch_exams after insert or update or delete on public.marks
  for each row execute function app.touch_exams();
create trigger exam_subjects_touch_exams after insert or update or delete on public.exam_subjects
  for each row execute function app.touch_exams();
create trigger enrollments_touch_exams after insert or update or delete on public.enrollments
  for each row execute function app.touch_exams();
create trigger class_subjects_touch_exams after insert or update or delete on public.class_subjects
  for each row execute function app.touch_exams();
create trigger students_touch_exams after update of status on public.students
  for each row when (old.status is distinct from new.status)
  execute function app.touch_exams();
create trigger school_settings_touch_exams after update of grading on public.school_settings
  for each row when (old.grading is distinct from new.grading)
  execute function app.touch_exams();

create or replace function app.results_current(p_exam_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select e.results_processed_at is not null
    and (e.inputs_changed_at is null or e.inputs_changed_at <= e.results_processed_at)
  from public.exams e where e.id = p_exam_id;
$$;

/**
 * Replaces every result of an exam (see 20261029003300_results.sql). p_as_of is when the
 * caller started reading marks: a change made while it was working stays "after" the
 * processing time, so the results show as out of date instead of current.
 */
drop function public.save_exam_results(bigint, jsonb);
create function public.save_exam_results(p_exam_id bigint, p_rows jsonb,
  p_as_of timestamptz default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_session bigint;
  v_status public.exam_status;
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'only admins process results' using errcode = '42501';
  end if;
  select session_id, status into v_session, v_status from public.exams where id = p_exam_id
  for update;
  if v_status is distinct from 'review' then
    raise exception 'results are processed while the exam is in review' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  delete from public.results where exam_id = p_exam_id;
  insert into public.results (exam_id, student_id, section_id, group_id, roll, total, full_total,
    gpa, gpa_without_fourth, grade, passed, failed_count, section_position, class_position,
    attendance_percent, subjects)
  select p_exam_id, x.student_id, en.section_id, en.group_id, en.roll, x.total, x.full_total,
    x.gpa, x.gpa_without_fourth, x.grade, x.passed, x.failed_count, x.section_position,
    x.class_position, x.attendance_percent, x.subjects
  from jsonb_to_recordset(p_rows) as x(student_id bigint, total numeric, full_total integer,
    gpa numeric, gpa_without_fourth numeric, grade text, passed boolean, failed_count smallint,
    section_position integer, class_position integer, attendance_percent numeric, subjects jsonb)
  join public.enrollments en on en.student_id = x.student_id and en.session_id = v_session
  join public.sections s on s.id = en.section_id
  join public.exam_classes ec on ec.exam_id = p_exam_id and ec.class_id = s.class_id;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'a student does not sit this exam' using errcode = '22023';
  end if;
  update public.exams set results_processed_at = least(now(), coalesce(p_as_of, now()))
  where id = p_exam_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'results.processed', 'exam', p_exam_id::text,
    jsonb_build_object('students', v_count));
  return v_count;
end;
$$;
revoke execute on function public.save_exam_results(bigint, jsonb, timestamptz) from public, anon;
grant execute on function public.save_exam_results(bigint, jsonb, timestamptz) to authenticated;

-- S3: the author of a mark is whoever saved it, not what the request says.
create function app.stamp_mark_author()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.entered_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger marks_stamp_author before insert or update on public.marks
  for each row execute function app.stamp_mark_author();

-- S4: submitting needs the teacher role (or admin), not only an old assignment.
create or replace function app.can_enter_section(p_exam_subject_id bigint, p_section_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_admin() or (app.has_role('teacher') and exists (
    select 1 from public.exam_subjects es
    join public.exams e on e.id = es.exam_id
    join public.teacher_assignments ta
      on ta.subject_id = es.subject_id and ta.session_id = e.session_id
    where es.id = p_exam_subject_id and ta.section_id = p_section_id
      and ta.staff_id = app.my_staff_id()));
$$;

/** True when an enrolled student sits this exam subject (taught to everyone or their group). */
create function app.takes_subject(p_class_id bigint, p_subject_id bigint, p_group_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_subjects cs
    where cs.class_id = p_class_id and cs.subject_id = p_subject_id
      and (cs.group_id is null or cs.group_id = p_group_id));
$$;

-- C2/C5 (marks) and C3 (results): "Submit & lock" counts only students who take the
-- subject and are still at school, and a row is complete only when every part in use
-- has a mark (or the student is absent).
create or replace function public.submit_marks(p_exam_subject_id bigint, p_section_id bigint)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  es public.exam_subjects%rowtype;
  v_session bigint;
  v_status public.exam_status;
  v_students integer;
  v_missing integer;
begin
  if not app.can_enter_section(p_exam_subject_id, p_section_id) then
    raise exception 'not your subject and section' using errcode = '42501';
  end if;
  select * into es from public.exam_subjects where id = p_exam_subject_id;
  select e.session_id, e.status into v_session, v_status from public.exams e where e.id = es.exam_id;
  if v_status is distinct from 'marks_entry'
     or not exists (select 1 from public.sections where id = p_section_id and class_id = es.class_id) then
    raise exception 'this exam is not taking marks for that section' using errcode = '22023';
  end if;
  select count(*),
    count(*) filter (where not coalesce(m.is_absent
      or ((es.cq_full = 0 or m.cq is not null) and (es.mcq_full = 0 or m.mcq is not null)
          and (es.practical_full = 0 or m.practical is not null)), false))
  into v_students, v_missing
  from public.enrollments en
  join public.students st on st.id = en.student_id and st.status not in ('transferred', 'inactive')
  left join public.marks m on m.student_id = en.student_id and m.exam_subject_id = p_exam_subject_id
  where en.section_id = p_section_id and en.session_id = v_session
    and app.takes_subject(es.class_id, es.subject_id, en.group_id);
  if v_missing > 0 then
    raise exception '% students have no marks', v_missing using errcode = '23514';
  end if;
  insert into public.mark_locks (exam_subject_id, section_id, locked_by)
  values (p_exam_subject_id, p_section_id, auth.uid())
  on conflict do nothing;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'marks.submitted', 'exam_subject', p_exam_subject_id::text,
    jsonb_build_object('section_id', p_section_id, 'students', v_students));
  return v_students;
end;
$$;

-- C3 (marks): full marks cannot drop below marks already saved.
create function public.check_full_marks_cover_saved()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.marks m where m.exam_subject_id = new.id
      and (m.cq > new.cq_full or m.mcq > new.mcq_full or m.practical > new.practical_full)) then
    raise exception 'saved marks are above the new full marks' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exam_subjects_cover_saved before update of cq_full, mcq_full, practical_full
  on public.exam_subjects for each row execute function public.check_full_marks_cover_saved();

-- S6: before publication, results are for the office and the class teacher only (a
-- subject teacher sees other subjects' marks only once the exam is published).
drop policy "results visible to admins, section teachers, and the family once published"
  on public.results;
create policy "results visible to admins, class teachers, section teachers once published, and the family once published"
  on public.results for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher')) and (
      exists (select 1 from public.sections s
              where s.id = results.section_id and s.class_teacher_id = (select app.my_staff_id()))
      or (section_id = any ((select app.teacher_section_ids())::bigint[])
          and exists (select 1 from public.exams e where e.id = results.exam_id and e.status = 'published'))))
    or ((student_id = (select app.my_student_id())
         or student_id = any ((select app.guardian_student_ids())::bigint[]))
        and exists (select 1 from public.exams e where e.id = results.exam_id and e.status = 'published'))
  );

-- P1: attendance counts per student in SQL (school days only: working weekdays, not
-- holidays) instead of reading every row. Same rule as src/lib/attendance.ts summarize().
create function public.attendance_counts(p_section_ids bigint[], p_from date, p_to date)
returns table (student_id bigint, present integer, absent integer, late integer, on_leave integer)
language sql stable set search_path = ''
as $$
  select a.student_id,
    count(*) filter (where a.status = 'present')::int,
    count(*) filter (where a.status = 'absent')::int,
    count(*) filter (where a.status = 'late')::int,
    count(*) filter (where a.status = 'leave')::int
  from public.attendance a
  where a.section_id = any (p_section_ids) and a.date between p_from and p_to
    and extract(dow from a.date)::smallint = any (
      coalesce((select working_days from public.school_settings limit 1), '{6,0,1,2,3,4}'))
    and not exists (select 1 from public.holidays h where a.date between h.starts_on and h.ends_on)
  group by a.student_id;
$$;
revoke execute on function public.attendance_counts(bigint[], date, date) from public, anon;
grant execute on function public.attendance_counts(bigint[], date, date) to authenticated;
