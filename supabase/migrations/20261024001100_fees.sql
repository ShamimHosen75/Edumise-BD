-- Step 1.2 / 11: fee setup and invoices. All money is bigint poisha (BDT x 100).
-- Payments are added in Step 5.2.

create table public.fee_heads (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9_]+$'),
  name_en text not null,
  name_bn text not null default '',
  frequency public.fee_frequency not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fee_structures (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.academic_sessions (id) on delete cascade,
  class_id bigint not null references public.classes (id) on delete cascade,
  group_id bigint references public.groups (id) on delete cascade,
  fee_head_id bigint not null references public.fee_heads (id) on delete restrict,
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (session_id, class_id, group_id, fee_head_id)
);

create table public.fee_waivers (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  session_id bigint not null references public.academic_sessions (id) on delete cascade,
  fee_head_id bigint not null references public.fee_heads (id) on delete cascade,
  kind public.waiver_kind not null,
  -- percent: 1..100; fixed: poisha
  value bigint not null check (value > 0),
  reason text not null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
create index fee_waivers_student_idx on public.fee_waivers (student_id, session_id);

create table public.invoices (
  id bigint generated always as identity primary key,
  invoice_no text not null unique,
  student_id bigint not null references public.students (id) on delete restrict,
  session_id bigint not null references public.academic_sessions (id) on delete restrict,
  issued_on date not null default current_date,
  due_on date not null,
  status public.invoice_status not null default 'unpaid',
  total bigint not null default 0 check (total >= 0),
  paid bigint not null default 0 check (paid >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_on >= issued_on),
  check (paid <= total)
);
create index invoices_student_idx on public.invoices (student_id, session_id);

-- period_key: 'YYYY-MM' for monthly heads, or a label (e.g. 'exam:12') for one-time heads.
create table public.invoice_items (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references public.invoices (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete restrict,
  fee_head_id bigint not null references public.fee_heads (id) on delete restrict,
  period_key text not null,
  gross bigint not null check (gross >= 0),
  waiver bigint not null default 0 check (waiver >= 0),
  net bigint generated always as (gross - waiver) stored,
  created_at timestamptz not null default now(),
  check (waiver <= gross),
  -- Never bill the same student twice for the same head and period.
  unique (student_id, fee_head_id, period_key)
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- invoice_items.student_id must match its invoice.
create function public.check_invoice_item_student()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id <> (select student_id from public.invoices where id = new.invoice_id) then
    raise exception 'Invoice item student does not match invoice' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger invoice_items_student_check before insert or update on public.invoice_items
  for each row execute function public.check_invoice_item_student();

create trigger fee_heads_updated_at before update on public.fee_heads
  for each row execute function public.set_updated_at();
create trigger fee_structures_updated_at before update on public.fee_structures
  for each row execute function public.set_updated_at();
create trigger fee_waivers_updated_at before update on public.fee_waivers
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.fee_heads enable row level security;
alter table public.fee_structures enable row level security;
alter table public.fee_waivers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
