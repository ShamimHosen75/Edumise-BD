-- Step 5.1: fee setup and invoices (FEE-01, FEE-02). The tables come from Step 1.2
-- (20261024001100_fees.sql); this adds the late-fine settings, waiver approval, invoice
-- numbers and the invoice generator. Money is whole poisha.

-- Late fine and default due date (one row). Read by everyone signed in (families see
-- the fine on their bills), changed by the office and the accountant.
create table public.fee_settings (
  id smallint primary key default 1 check (id = 1),
  late_fine_per_day bigint not null default 0 check (late_fine_per_day between 0 and 100000000),
  late_fine_cap bigint not null default 0 check (late_fine_cap between 0 and 100000000),
  grace_days smallint not null default 0 check (grace_days between 0 and 60),
  due_days smallint not null default 15 check (due_days between 0 and 90),
  updated_at timestamptz not null default now()
);
insert into public.fee_settings (id) values (1);
create trigger fee_settings_updated_at before update on public.fee_settings
  for each row execute function public.set_updated_at();
alter table public.fee_settings enable row level security;
create policy "signed-in users read fee settings" on public.fee_settings
  for select to authenticated using (true);
create policy "admins and accountants change fee settings" on public.fee_settings
  for update to authenticated
  using ((select app.has_role('super_admin', 'admin', 'accountant')))
  with check ((select app.has_role('super_admin', 'admin', 'accountant')));

-- Waivers: only an admin approves. A waiver an accountant adds or changes waits for an
-- admin; one an admin saves is approved by them.
create function app.stamp_waiver_approval()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- seed data and server maintenance keep what they set
  end if;
  if app.is_admin() then
    new.approved_by := auth.uid();
    new.approved_at := now();
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
create trigger fee_waivers_approval before insert or update on public.fee_waivers
  for each row execute function app.stamp_waiver_approval();

-- Invoice numbers: INV-2026-000123, a counter per year that never goes back.
create table public.invoice_counters (
  year smallint primary key,
  last_no integer not null check (last_no >= 0)
);
alter table public.invoice_counters enable row level security;
create policy "admins and accountants read invoice counters" on public.invoice_counters
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));

create function app.next_invoice_no(p_year integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_no integer;
begin
  insert into public.invoice_counters (year, last_no)
  values (p_year, coalesce((
    select max(substring(invoice_no from '^INV-\d{4}-(\d+)$')::integer)
    from public.invoices where invoice_no like 'INV-' || p_year || '-%'), 0) + 1)
  on conflict (year) do update set last_no = public.invoice_counters.last_no + 1
  returning last_no into v_no;
  return format('INV-%s-%s', p_year, lpad(v_no::text, 6, '0'));
end;
$$;

/**
 * Creates the invoices planned by src/lib/fees.ts planInvoices() in one transaction.
 * p_rows: [{student_id, items: [{fee_head_id, gross, waiver}]}]. An item already billed
 * for that student, head and period is skipped (unique index), and an invoice left with
 * no items is not created, so running the generator twice adds nothing.
 * Returns {created, skipped}. Errors: 42501 not allowed; 22023 bad period, a head whose
 * frequency does not fit the period, or a student not enrolled in the session.
 */
create function public.create_invoices(p_session_id bigint, p_period_key text,
  p_due_on date, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_monthly boolean;
  v_row jsonb;
  v_invoice bigint;
  v_items integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_today date := app.dhaka_today();
begin
  if not app.has_role('super_admin', 'admin', 'accountant') then
    raise exception 'only the office and the accountant make invoices' using errcode = '42501';
  end if;
  if p_period_key ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_monthly := true;
  elsif p_period_key ~ '^(session|exam):\d+$' then
    v_monthly := false;
  else
    raise exception 'bad period' using errcode = '22023';
  end if;
  if p_due_on < v_today then
    raise exception 'the due date has passed' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r, jsonb_array_elements(r -> 'items') i
    join public.fee_heads h on h.id = (i ->> 'fee_head_id')::bigint
    where (h.frequency = 'monthly') <> v_monthly) then
    raise exception 'fee head does not fit the period' using errcode = '22023';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    if not exists (select 1 from public.enrollments
                   where student_id = (v_row ->> 'student_id')::bigint and session_id = p_session_id) then
      raise exception 'student % is not enrolled in this session', v_row ->> 'student_id'
        using errcode = '22023';
    end if;
    insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, created_by)
    values (app.next_invoice_no(extract(year from v_today)::integer),
      (v_row ->> 'student_id')::bigint, p_session_id, v_today, p_due_on, auth.uid())
    returning id into v_invoice;
    insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, waiver)
    select v_invoice, (v_row ->> 'student_id')::bigint, (i ->> 'fee_head_id')::bigint, p_period_key,
      (i ->> 'gross')::bigint, (i ->> 'waiver')::bigint
    from jsonb_array_elements(v_row -> 'items') i
    on conflict (student_id, fee_head_id, period_key) do nothing;
    get diagnostics v_items = row_count;
    v_skipped := v_skipped + jsonb_array_length(v_row -> 'items') - v_items;
    if v_items = 0 then
      delete from public.invoices where id = v_invoice;
    else
      update public.invoices i set total = t.net,
        status = case when t.net = 0 then 'paid'::public.invoice_status else 'unpaid' end
      from (select coalesce(sum(net), 0) as net from public.invoice_items where invoice_id = v_invoice) t
      where i.id = v_invoice;
      v_created := v_created + 1;
    end if;
  end loop;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'invoices.generated', 'session', p_session_id::text,
    jsonb_build_object('period', p_period_key, 'created', v_created, 'skipped', v_skipped));
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;
revoke execute on function public.create_invoices(bigint, text, date, jsonb) from public, anon;
grant execute on function public.create_invoices(bigint, text, date, jsonb) to authenticated;

/**
 * Copies a session's fee structure into another session. Rows the target already has
 * are kept. Returns the number of rows copied.
 */
create function public.copy_fee_structure(p_from bigint, p_to bigint)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not app.has_role('super_admin', 'admin', 'accountant') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from = p_to then
    raise exception 'choose another session' using errcode = '22023';
  end if;
  insert into public.fee_structures (session_id, class_id, group_id, fee_head_id, amount)
  select p_to, class_id, group_id, fee_head_id, amount
  from public.fee_structures where session_id = p_from
  on conflict (session_id, class_id, group_id, fee_head_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.copy_fee_structure(bigint, bigint) from public, anon;
grant execute on function public.copy_fee_structure(bigint, bigint) to authenticated;

create index invoice_items_period_idx on public.invoice_items (period_key, fee_head_id);
