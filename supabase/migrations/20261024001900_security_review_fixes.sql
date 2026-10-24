-- Phase 1 code review fixes.

-- 1. Only admins (or trusted server code) may change must_change_password, so a user
--    cannot skip the forced password change by editing their own profile via the API.
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
       or new.must_change_password is distinct from old.must_change_password then
      raise exception 'Only an admin can change role, status, email, phone or password flags'
        using errcode = '42501';
    end if;
  elsif not app.has_role('super_admin')
        and (old.role = 'super_admin' or new.role = 'super_admin') then
    raise exception 'Only a super admin can change a super admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2. Visitors may read only the public staff columns (not profile_id, the login link).
revoke select on public.staff from anon;
grant select (id, designation_id, full_name_en, full_name_bn, photo_path, subject_en, subject_bn,
  qualification_en, qualification_bn, bio_en, bio_bn, joined_on, left_on, is_public, sort_order)
  on public.staff to anon;

-- 3. Rate limiting for login and password reset (and later contact/result search).
--    Keys are hashed by the app, so no raw IPs or emails are stored.
create table app.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on app.rate_limit_hits (key, hit_at);
alter table app.rate_limit_hits enable row level security;
-- No policies: only the security definer functions below touch this table.

-- Records one hit and returns true when the key is over its limit for the window.
create function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) = 0 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  delete from app.rate_limit_hits
  where key = p_key and hit_at < now() - make_interval(secs => p_window_seconds);
  insert into app.rate_limit_hits (key) values (p_key);
  select count(*) into v_count from app.rate_limit_hits where key = p_key;
  return v_count > p_max;
end;
$$;

-- Read-only check (does not record a hit).
create function public.is_rate_limited(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select count(*) >= p_max from app.rate_limit_hits
  where key = p_key and hit_at >= now() - make_interval(secs => p_window_seconds);
$$;

-- Server code only (service role). Browsers cannot call these.
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.is_rate_limited(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.is_rate_limited(text, integer, integer) to service_role;
