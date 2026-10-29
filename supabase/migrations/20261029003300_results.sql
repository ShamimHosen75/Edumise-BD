-- Step 4.3: grading and results. Results are worked out on the server with
-- src/lib/grading.ts and saved for a whole exam in one transaction by
-- save_exam_results(). Visitors find one mark sheet through lookup_result(), which only
-- the server calls (after its rate limit), so nobody can list results.

-- Two papers of one subject (Bangla 1st and 2nd paper) share a paper group and are graded
-- together (open question 32).
alter table public.subjects add column paper_group text
  check (paper_group ~ '^[A-Za-z0-9_-]{1,20}$');

alter table public.exams add column results_processed_at timestamptz;

create table public.results (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.exams (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  section_id bigint not null references public.sections (id) on delete restrict,
  group_id bigint references public.groups (id) on delete set null,
  roll smallint not null check (roll > 0),
  total numeric(7, 2) not null check (total >= 0),
  full_total integer not null check (full_total >= 0),
  gpa numeric(3, 2) not null check (gpa between 0 and 5),
  gpa_without_fourth numeric(3, 2) not null check (gpa_without_fourth between 0 and 5),
  grade text not null check (length(grade) between 1 and 3),
  passed boolean not null,
  failed_count smallint not null default 0 check (failed_count >= 0),
  section_position integer not null check (section_position > 0),
  class_position integer not null check (class_position > 0),
  attendance_percent numeric(4, 1) check (attendance_percent between 0 and 100),
  -- Snapshot of each subject (names, paper marks, grade) when the result was processed.
  subjects jsonb not null check (jsonb_typeof(subjects) = 'array'),
  created_at timestamptz not null default now(),
  unique (exam_id, student_id),
  check (passed or gpa = 0)
);
create index results_exam_section_idx on public.results (exam_id, section_id);
create index results_student_idx on public.results (student_id);
alter table public.results enable row level security;

-- Read only: rows are written by save_exam_results() alone.
create policy "results visible to admins, section teachers, and the family once published"
  on public.results for select to authenticated
  using (
    (select app.is_admin())
    or ((select app.has_role('teacher')) and section_id = any ((select app.teacher_section_ids())::bigint[]))
    or ((student_id = (select app.my_student_id())
         or student_id = any ((select app.guardian_student_ids())::bigint[]))
        and exists (select 1 from public.exams e where e.id = results.exam_id and e.status = 'published'))
  );

/**
 * Replaces every result of an exam. p_rows: one object per student with total,
 * full_total, gpa, gpa_without_fourth, grade, passed, failed_count, section_position,
 * class_position, attendance_percent and subjects. Section, group and roll come from the
 * student's enrolment, not from the caller. Errors: 42501 not an admin, 22023 exam not in
 * review or a student not sitting the exam.
 */
create function public.save_exam_results(p_exam_id bigint, p_rows jsonb)
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
  update public.exams set results_processed_at = now() where id = p_exam_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'results.processed', 'exam', p_exam_id::text,
    jsonb_build_object('students', v_count));
  return v_count;
end;
$$;
revoke execute on function public.save_exam_results(bigint, jsonb) from public, anon;
grant execute on function public.save_exam_results(bigint, jsonb) to authenticated;

/** True when the exam's results were processed after its last marks or subject change. */
create function app.results_current(p_exam_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select e.results_processed_at is not null
    and not exists (
      select 1 from public.exam_subjects es
      left join public.marks m on m.exam_subject_id = es.id
      where es.exam_id = e.id
        and (es.updated_at > e.results_processed_at or m.updated_at > e.results_processed_at))
  from public.exams e where e.id = p_exam_id;
$$;

-- An exam is published only with up-to-date results.
create function public.check_exam_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and not coalesce(app.results_current(new.id), false) then
    raise exception 'process the results before publishing' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger exams_check_publish before update of status on public.exams
  for each row execute function public.check_exam_publish();

/**
 * One mark sheet of a published exam, found by section and roll (and group when given).
 * Only safe fields: no student ID, birth date, guardian or contact details, no photo.
 * Called by the server (service role) after its rate limit.
 */
create function public.lookup_result(p_exam_id bigint, p_section_id bigint, p_roll integer,
  p_group_id bigint default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'exam_en', e.name_en, 'exam_bn', e.name_bn, 'session', se.name,
    'name_en', st.full_name_en, 'name_bn', st.full_name_bn,
    'class_en', c.name_en, 'class_bn', c.name_bn,
    'section_en', s.name_en, 'section_bn', s.name_bn,
    'group_en', g.name_en, 'group_bn', g.name_bn,
    'roll', r.roll, 'total', r.total, 'full_total', r.full_total, 'gpa', r.gpa,
    'gpa_without_fourth', r.gpa_without_fourth, 'grade', r.grade, 'passed', r.passed,
    'failed_count', r.failed_count, 'section_position', r.section_position,
    'class_position', r.class_position, 'attendance_percent', r.attendance_percent,
    'subjects', r.subjects, 'published_at', e.published_at)
  from public.results r
  join public.exams e on e.id = r.exam_id and e.status = 'published'
  join public.academic_sessions se on se.id = e.session_id
  join public.students st on st.id = r.student_id
  join public.sections s on s.id = r.section_id
  join public.classes c on c.id = s.class_id
  left join public.groups g on g.id = r.group_id
  where r.exam_id = p_exam_id and r.section_id = p_section_id and r.roll = p_roll
    and (p_group_id is null or r.group_id = p_group_id);
$$;
revoke execute on function public.lookup_result(bigint, bigint, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.lookup_result(bigint, bigint, integer, bigint) to service_role;

-- Board exam results (WEB-11): entered by the office, shown on the website.
create table public.board_results (
  id bigint generated always as identity primary key,
  exam text not null default 'ssc' check (exam in ('ssc', 'jsc')),
  year smallint not null check (year between 1950 and 2100),
  examinees integer not null check (examinees > 0),
  passed integer not null check (passed >= 0),
  gpa5 integer not null default 0 check (gpa5 >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam, year),
  check (passed <= examinees),
  check (gpa5 <= passed)
);
create trigger board_results_updated_at before update on public.board_results
  for each row execute function public.set_updated_at();
alter table public.board_results enable row level security;
create policy "board results are public" on public.board_results
  for select to anon, authenticated using (true);
create policy "admins manage board results" on public.board_results
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
