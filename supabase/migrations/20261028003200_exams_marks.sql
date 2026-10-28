-- Step 4.2: exams and marks. Marks are entered while an exam is in "marks_entry"; a
-- teacher's "Submit & lock" locks one subject for one section (open question 29), and
-- only an admin can unlock it. Published means exams.status = 'published' (question 27).

alter table public.exams add constraint exams_session_name_key unique (session_id, name_en);

create table public.mark_locks (
  exam_subject_id bigint not null references public.exam_subjects (id) on delete cascade,
  section_id bigint not null references public.sections (id) on delete cascade,
  locked_by uuid references public.profiles (id) on delete set null,
  locked_at timestamptz not null default now(),
  primary key (exam_subject_id, section_id)
);
create index mark_locks_section_idx on public.mark_locks (section_id);
alter table public.mark_locks enable row level security;
-- Staff see which subjects are submitted; locks change only through the functions below.
create policy "staff read mark locks" on public.mark_locks
  for select to authenticated using ((select app.is_staff()));

-- Teachers write marks for their own subject and section, while the exam takes marks and
-- until that section's subject is submitted.
create or replace function app.teacher_can_mark(p_exam_subject_id bigint, p_student_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role('teacher')
    and app.teacher_teaches(p_exam_subject_id, p_student_id)
    and exists (
      select 1 from public.exam_subjects es join public.exams e on e.id = es.exam_id
      where es.id = p_exam_subject_id and e.status = 'marks_entry' and not es.locked)
    and not exists (
      select 1 from public.mark_locks ml
      join public.exam_subjects es on es.id = ml.exam_subject_id
      join public.exams e on e.id = es.exam_id
      join public.enrollments en
        on en.section_id = ml.section_id and en.session_id = e.session_id
      where ml.exam_subject_id = p_exam_subject_id and en.student_id = p_student_id);
$$;

/** True when the caller may submit or see entry for this subject in this section. */
create function app.can_enter_section(p_exam_subject_id bigint, p_section_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_admin() or exists (
    select 1 from public.exam_subjects es
    join public.exams e on e.id = es.exam_id
    join public.teacher_assignments ta
      on ta.subject_id = es.subject_id and ta.session_id = e.session_id
    where es.id = p_exam_subject_id and ta.section_id = p_section_id
      and ta.staff_id = app.my_staff_id());
$$;

/**
 * "Submit & lock": every student of the section must have marks or be marked absent.
 * Returns the number of students. Errors: 42501 not allowed, 22023 exam not taking
 * marks or section not in the class, 23514 marks missing.
 */
create function public.submit_marks(p_exam_subject_id bigint, p_section_id bigint)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_session bigint;
  v_class bigint;
  v_status public.exam_status;
  v_students integer;
  v_missing integer;
begin
  if not app.can_enter_section(p_exam_subject_id, p_section_id) then
    raise exception 'not your subject and section' using errcode = '42501';
  end if;
  select e.session_id, es.class_id, e.status into v_session, v_class, v_status
  from public.exam_subjects es join public.exams e on e.id = es.exam_id
  where es.id = p_exam_subject_id;
  if v_status is distinct from 'marks_entry'
     or not exists (select 1 from public.sections where id = p_section_id and class_id = v_class) then
    raise exception 'this exam is not taking marks for that section' using errcode = '22023';
  end if;
  select count(*), count(*) filter (where m.id is null) into v_students, v_missing
  from public.enrollments en
  left join public.marks m on m.student_id = en.student_id and m.exam_subject_id = p_exam_subject_id
    and (m.is_absent or m.cq is not null or m.mcq is not null or m.practical is not null)
  where en.section_id = p_section_id and en.session_id = v_session;
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
revoke execute on function public.submit_marks(bigint, bigint) from public, anon;
grant execute on function public.submit_marks(bigint, bigint) to authenticated;

/** Admins reopen a submitted subject for a section. */
create function public.unlock_marks(p_exam_subject_id bigint, p_section_id bigint)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admins unlock marks' using errcode = '42501';
  end if;
  delete from public.mark_locks
  where exam_subject_id = p_exam_subject_id and section_id = p_section_id;
  if not found then
    return false;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'marks.unlocked', 'exam_subject', p_exam_subject_id::text,
    jsonb_build_object('section_id', p_section_id));
  return true;
end;
$$;
revoke execute on function public.unlock_marks(bigint, bigint) from public, anon;
grant execute on function public.unlock_marks(bigint, bigint) to authenticated;
