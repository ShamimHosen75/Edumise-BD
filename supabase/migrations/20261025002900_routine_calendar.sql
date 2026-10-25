-- Step 3.5: exam schedule, holidays (academic calendar) and saving a section's routine.

-- One sitting per class and subject in an exam. Public once the exam's schedule is
-- published (exams.schedule_published), independent of results.
create table public.exam_schedule (
  id bigint generated always as identity primary key,
  exam_id bigint not null references public.exams (id) on delete cascade,
  class_id bigint not null references public.classes (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete restrict,
  exam_date date not null,
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, class_id, subject_id),
  check (ends_at > starts_at)
);
create index exam_schedule_exam_idx on public.exam_schedule (exam_id, class_id, exam_date);
create trigger exam_schedule_updated_at before update on public.exam_schedule
  for each row execute function public.set_updated_at();

-- Holidays and other closed days, shown on the calendar (and used by attendance later).
create table public.holidays (
  id bigint generated always as identity primary key,
  title_en text not null check (length(title_en) between 1 and 120),
  title_bn text not null default '' check (length(title_bn) <= 120),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index holidays_starts_idx on public.holidays (starts_on);
create trigger holidays_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();

alter table public.exam_schedule enable row level security;
alter table public.holidays enable row level security;

create policy "published exam schedules are visible" on public.exam_schedule
  for select to anon, authenticated
  using (
    (select app.is_staff())
    or exists (select 1 from public.exams e where e.id = exam_schedule.exam_id and e.schedule_published)
  );
create policy "admins manage exam schedules" on public.exam_schedule
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "anyone reads holidays" on public.holidays
  for select to anon, authenticated using (true);
create policy "admins manage holidays" on public.holidays
  for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

/**
 * Replaces one section's weekly routine in a session in one transaction.
 * p_cells: [{day_of_week, period_id, subject_id, staff_id, room_id}]. Break periods take
 * no class. A teacher or room already used elsewhere at the same time fails with 23505
 * (unique indexes routine_teacher_clash / routine_room_clash), and nothing changes.
 */
create function public.save_section_routine(p_session_id bigint, p_section_id bigint, p_cells jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'only admins edit the routine' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 100 then
    raise exception 'cells must be a list of at most 100' using errcode = '22023';
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
revoke execute on function public.save_section_routine(bigint, bigint, jsonb) from public, anon;
grant execute on function public.save_section_routine(bigint, bigint, jsonb) to authenticated;
