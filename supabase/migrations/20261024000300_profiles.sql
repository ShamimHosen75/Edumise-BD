-- Step 1.2 / 3: one profile per login. The role lives here (and in the JWT from Step 1.3).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- NULL role = no access. Roles are only ever set by trusted server code.
  role public.app_role,
  full_name_en text not null default '',
  full_name_bn text not null default '',
  email text,
  phone text unique check (phone is null or public.is_bd_phone(phone)),
  avatar_path text,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Create a profile whenever a login is created. The role is read from app_metadata
-- (only the service role can set it), never from user_metadata (the user can edit that).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_app_meta_data ->> 'app_role';
begin
  insert into public.profiles (id, role, email, phone, full_name_en, full_name_bn)
  values (
    new.id,
    case
      when requested in ('super_admin', 'admin', 'teacher', 'accountant', 'student', 'guardian')
        then requested::public.app_role
    end,
    new.email,
    nullif(new.raw_app_meta_data ->> 'phone', ''),
    coalesce(new.raw_app_meta_data ->> 'full_name_en', ''),
    coalesce(new.raw_app_meta_data ->> 'full_name_bn', '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
