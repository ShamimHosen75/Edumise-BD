-- Step 3.1: academic structure management.

-- Makes one session the current one, in a single statement so there is never a moment
-- with two (or no) current sessions. Runs with the caller's rights: RLS lets only admins
-- update sessions, so for anyone else nothing changes.
create function public.set_current_session(p_session_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_found boolean;
begin
  select exists (select 1 from public.academic_sessions where id = p_session_id) into v_found;
  if not v_found then
    return false;
  end if;
  update public.academic_sessions set is_current = false where is_current and id <> p_session_id;
  update public.academic_sessions set is_current = true where id = p_session_id;
  return (select is_current from public.academic_sessions where id = p_session_id);
end;
$$;

revoke execute on function public.set_current_session(bigint) from public, anon;
grant execute on function public.set_current_session(bigint) to authenticated;

-- Section names are unique per class whatever their case ("A" and "a").
create unique index sections_class_name_ci on public.sections (class_id, lower(name_en));
