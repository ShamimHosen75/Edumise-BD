-- Step 1.3 / 1: move staff private fields into their own table.
-- Row level security works on whole rows, so private fields need their own table to
-- keep the public staff directory readable while NID, birth date, address and personal
-- phone stay locked to admins and the staff member themselves.

create table public.staff_private (
  staff_id bigint primary key references public.staff (id) on delete cascade,
  nid text check (nid is null or nid ~ '^([0-9]{10}|[0-9]{13}|[0-9]{17})$'),
  birth_date date,
  address text,
  personal_phone text check (personal_phone is null or public.is_bd_phone(personal_phone)),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.staff_private (staff_id, nid, birth_date, address, personal_phone, email)
select id, nid, birth_date, address, personal_phone, email from public.staff;

alter table public.staff
  drop column nid,
  drop column birth_date,
  drop column address,
  drop column personal_phone,
  drop column email;

create trigger staff_private_updated_at before update on public.staff_private
  for each row execute function public.set_updated_at();

alter table public.staff_private enable row level security;
