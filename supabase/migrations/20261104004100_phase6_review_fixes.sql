-- Phase 6 code review fixes (docs/code-review-phase-6.md).

-- S1: an admin could make anyone an admin (and switch another admin off) straight through
-- the API, although the app lets only a super admin manage admin accounts. The trigger
-- now enforces the same rule: only a super admin changes the role, status, contact
-- details or password flag of an admin, or gives the admin role to anyone.
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
  elsif not app.has_role('super_admin') then
    if old.role = 'super_admin' or new.role = 'super_admin' then
      raise exception 'Only a super admin can change a super admin' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and (old.role = 'admin' or new.role = 'admin') then
      raise exception 'Only a super admin can give or take the admin role' using errcode = '42501';
    end if;
    if old.role = 'admin' and old.id <> auth.uid()
       and (new.is_active is distinct from old.is_active
            or new.email is distinct from old.email or new.phone is distinct from old.phone
            or new.must_change_password is distinct from old.must_change_password) then
      raise exception 'Only a super admin can change another admin''s login' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- S5: a successful sign-in clears the account's failure counters, so an attacker cannot
-- keep the real owner locked out by filling the hourly cap from many addresses.
create function public.clear_rate_limit(p_key text)
returns void
language sql security definer set search_path = ''
as $$
  delete from app.rate_limit_hits where key = p_key;
$$;
revoke execute on function public.clear_rate_limit(text) from public, anon, authenticated;
grant execute on function public.clear_rate_limit(text) to service_role;
