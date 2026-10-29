-- Step 5.2: fee collection (FEE-03..FEE-05). Payments, receipts, the late fine frozen
-- at the first payment, and cancellation. Money is whole poisha.
--
-- Payments and their allocations are written only by record_payment() and
-- cancel_payment(); nobody deletes them. A cancelled payment keeps its receipt number.

create type public.payment_method as enum ('cash', 'bkash', 'nagad', 'rocket', 'bank');

-- The late fine is an invoice item of this head (open question 39), one per invoice.
insert into public.fee_heads (code, name_en, name_bn, frequency, sort_order)
values ('LATE_FINE', 'Late fine', 'বিলম্ব জরিমানা', 'one_time', 99)
on conflict (code) do nothing;
alter table public.invoice_items add column is_fine boolean not null default false;
alter table public.invoice_items add constraint invoice_items_fine_period
  check (not is_fine or period_key = 'fine:' || invoice_id);

create function app.late_fine_head()
returns bigint
language sql stable set search_path = ''
as $$
  select id from public.fee_heads where code = 'LATE_FINE';
$$;

-- The late-fine head is the system's: it keeps its code and is never deleted.
create function app.guard_late_fine_head()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.code = 'LATE_FINE' and (tg_op = 'DELETE' or new.code <> 'LATE_FINE' or new.frequency <> old.frequency) then
    raise exception 'the late-fine head cannot be changed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger fee_heads_guard_late_fine before update or delete on public.fee_heads
  for each row execute function app.guard_late_fine_head();

-- Receipt numbers: RCP-2026-000123, a counter per year that never goes back.
create table public.receipt_counters (
  year smallint primary key,
  last_no integer not null check (last_no >= 0)
);
alter table public.receipt_counters enable row level security;
create policy "admins and accountants read receipt counters" on public.receipt_counters
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));

create table public.payments (
  id bigint generated always as identity primary key,
  receipt_no text not null unique check (receipt_no ~ '^RCP-\d{4}-\d{6}$'),
  student_id bigint not null references public.students (id) on delete restrict,
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  txn_id text check (txn_id ~ '^[A-Z0-9-]{4,40}$'),
  paid_on date not null,
  note text not null default '' check (char_length(note) <= 300),
  collected_by uuid references public.profiles (id) on delete set null,
  -- Kept on the receipt even if the account is removed; families cannot read profiles.
  collected_by_name text not null default '',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) between 3 and 300),
  -- Mobile banking needs its transaction ID (open question 42).
  check (method not in ('bkash', 'nagad', 'rocket') or txn_id is not null),
  check ((cancelled_at is null) = (cancel_reason is null))
);
-- The same transaction cannot be recorded twice (a cancelled one may be entered again).
create unique index payments_txn_idx on public.payments (method, txn_id)
  where txn_id is not null and cancelled_at is null;
create index payments_student_idx on public.payments (student_id, paid_on);
create index payments_paid_on_idx on public.payments (paid_on);

create table public.payment_allocations (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.payments (id) on delete restrict,
  invoice_item_id bigint not null references public.invoice_items (id) on delete restrict,
  amount bigint not null check (amount > 0),
  unique (payment_id, invoice_item_id)
);
create index payment_allocations_item_idx on public.payment_allocations (invoice_item_id);

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;

-- Read only: the office and the accountant see all; a student and their guardians see
-- their own. Teachers see nothing. No write policies: only the functions below write.
create policy "admins and accountants read payments" on public.payments
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));
create policy "students and guardians read own payments" on public.payments
  for select to authenticated
  using (student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[]));
create policy "people who see the payment read its allocations" on public.payment_allocations
  for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id));

-- What each invoice item still owes, after payments that are not cancelled.
create view public.invoice_item_balances with (security_invoker = true) as
select ii.id, ii.invoice_id, ii.student_id, ii.net,
  coalesce(sum(a.amount) filter (where p.cancelled_at is null), 0)::bigint as paid,
  (ii.net - coalesce(sum(a.amount) filter (where p.cancelled_at is null), 0))::bigint as outstanding
from public.invoice_items ii
left join public.payment_allocations a on a.invoice_item_id = ii.id
left join public.payments p on p.id = a.payment_id
group by ii.id;

/** The late fine, the same rule as lateFine() in src/lib/fees.ts. */
create function app.late_fine(p_per_day bigint, p_cap bigint, p_grace integer,
  p_due_on date, p_today date, p_outstanding bigint)
returns bigint
language sql immutable set search_path = ''
as $$
  select case
    when p_per_day <= 0 or p_outstanding <= 0 or p_today - p_due_on - p_grace <= 0 then 0
    when p_cap > 0 then least(p_cap, (p_today - p_due_on - p_grace) * p_per_day)
    else (p_today - p_due_on - p_grace) * p_per_day
  end::bigint;
$$;

-- Only the payment functions change what an invoice has been paid. Direct edits by
-- the office keep the status in step with the money, and cannot add a fine item.
create function app.in_payment()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(current_setting('edumise.payment', true), '') = 'on';
$$;

create function app.guard_invoice_money()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null or app.in_payment() then
    return new; -- seed data, server maintenance and the payment functions
  end if;
  if new.paid is distinct from old.paid then
    raise exception 'only a payment changes what is paid' using errcode = '42501';
  end if;
  if new.status = 'cancelled' and new.paid > 0 then
    raise exception 'cancel the payments first' using errcode = '23514';
  end if;
  if new.status <> 'cancelled' and new.status is distinct from (case
      when new.paid = new.total then 'paid' when new.paid > 0 then 'partial' else 'unpaid'
    end)::public.invoice_status then
    raise exception 'status does not match what is paid' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger invoices_guard_money before update on public.invoices
  for each row execute function app.guard_invoice_money();

create function app.guard_invoice_item_money()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null or app.in_payment() then
    return coalesce(new, old);
  end if;
  if tg_op <> 'DELETE' and (new.is_fine or new.fee_head_id = app.late_fine_head()) then
    raise exception 'late fines are added when a payment is recorded' using errcode = '42501';
  end if;
  if tg_op <> 'INSERT' and exists (select 1 from public.payment_allocations where invoice_item_id = old.id) then
    raise exception 'this item has payments' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_items_guard_money before insert or update or delete on public.invoice_items
  for each row execute function app.guard_invoice_item_money();

/** Sets paid and status of invoices from their payments that are not cancelled. */
create function app.refresh_invoices(p_ids bigint[])
returns void
language sql security definer set search_path = ''
as $$
  update public.invoices i set paid = s.paid, total = s.total,
    status = case when i.status = 'cancelled' then i.status
      when s.paid = s.total then 'paid' when s.paid > 0 then 'partial' else 'unpaid' end
  from (select b.invoice_id, sum(b.net)::bigint as total, sum(b.paid)::bigint as paid
        from public.invoice_item_balances b where b.invoice_id = any (p_ids)
        group by b.invoice_id) s
  where i.id = s.invoice_id;
$$;
revoke execute on function app.refresh_invoices(bigint[]) from public, anon, authenticated;

create function app.next_receipt_no(p_year integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_no integer;
begin
  insert into public.receipt_counters (year, last_no) values (p_year, 1)
  on conflict (year) do update set last_no = public.receipt_counters.last_no + 1
  returning last_no into v_no;
  return format('RCP-%s-%s', p_year, lpad(v_no::text, 6, '0'));
end;
$$;
revoke execute on function app.next_receipt_no(integer) from public, anon, authenticated;

/**
 * Records a payment for the ticked invoice items of one student (open question 40).
 * - The late fine of each invoice touched is frozen once, as a fine item, at the rule
 *   and date of this first payment. A fine is always paid with its invoice's items.
 * - The amount goes to the oldest due date first, the fine before the fees, as
 *   allocate() in src/lib/collection.ts.
 * Returns {payment_id, receipt_no}. Errors: 42501 not allowed; 22023 bad input (no
 * items, an item of another student or of a cancelled invoice, missing transaction
 * ID); 23514 more than is owed; 23505 the transaction ID was already recorded.
 */
create function public.record_payment(p_student_id bigint, p_item_ids bigint[],
  p_amount bigint, p_method public.payment_method, p_txn_id text, p_note text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := app.dhaka_today();
  v_rule public.fee_settings;
  v_fine_head bigint;
  v_invoices bigint[];
  v_items bigint[];
  v_inv record;
  v_item record;
  v_fine bigint;
  v_owed bigint;
  v_left bigint := p_amount;
  v_take bigint;
  v_txn text := nullif(upper(btrim(coalesce(p_txn_id, ''))), '');
  v_payment bigint;
  v_receipt text;
begin
  if not app.has_role('super_admin', 'admin', 'accountant') then
    raise exception 'only the office and the accountant collect fees' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or coalesce(cardinality(p_item_ids), 0) = 0 then
    raise exception 'nothing to pay' using errcode = '22023';
  end if;
  if p_method in ('bkash', 'nagad', 'rocket') and v_txn is null then
    raise exception 'transaction ID needed' using errcode = '22023';
  end if;
  perform set_config('edumise.payment', 'on', true);

  -- Lock the invoices, so two people cannot take the same money at once.
  select array_agg(distinct ii.invoice_id) into v_invoices
  from public.invoice_items ii where ii.id = any (p_item_ids);
  perform 1 from public.invoices where id = any (v_invoices) order by id for update;
  if (select count(*) from public.invoice_items where id = any (p_item_ids))
       <> cardinality(array(select distinct unnest(p_item_ids)))
     or exists (select 1 from public.invoices
                where id = any (v_invoices) and (student_id <> p_student_id or status = 'cancelled')) then
    raise exception 'these items cannot be paid here' using errcode = '22023';
  end if;

  -- Freeze the late fine of each invoice that does not have one yet.
  select * into v_rule from public.fee_settings where id = 1;
  select id into v_fine_head from public.fee_heads where code = 'LATE_FINE';
  for v_inv in select id, due_on, total, paid from public.invoices
               where id = any (v_invoices) order by id loop
    continue when exists (select 1 from public.invoice_items where invoice_id = v_inv.id and is_fine);
    v_fine := app.late_fine(v_rule.late_fine_per_day, v_rule.late_fine_cap, v_rule.grace_days,
      v_inv.due_on, v_today, v_inv.total - v_inv.paid);
    continue when v_fine = 0;
    insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, is_fine)
    values (v_inv.id, p_student_id, v_fine_head, 'fine:' || v_inv.id, v_fine, true);
  end loop;

  -- The ticked items, plus the fines of their invoices.
  select array_agg(id) into v_items from public.invoice_items
  where id = any (p_item_ids) or (is_fine and invoice_id = any (v_invoices));
  select coalesce(sum(outstanding), 0) into v_owed
  from public.invoice_item_balances where id = any (v_items);
  if p_amount > v_owed then
    raise exception 'more than is owed (%)', v_owed using errcode = '23514';
  end if;

  v_receipt := app.next_receipt_no(extract(year from v_today)::integer);
  insert into public.payments (receipt_no, student_id, amount, method, txn_id, paid_on, note,
    collected_by, collected_by_name)
  values (v_receipt, p_student_id, p_amount, p_method, v_txn, v_today, btrim(coalesce(p_note, '')),
    auth.uid(), coalesce((select full_name_en from public.profiles where id = auth.uid()), ''))
  returning id into v_payment;

  for v_item in select b.id, b.outstanding from public.invoice_item_balances b
                join public.invoice_items ii on ii.id = b.id
                join public.invoices i on i.id = ii.invoice_id
                where b.id = any (v_items)
                order by i.due_on, ii.invoice_id, ii.is_fine desc, ii.id loop
    exit when v_left = 0;
    v_take := least(v_left, greatest(v_item.outstanding, 0));
    continue when v_take = 0;
    insert into public.payment_allocations (payment_id, invoice_item_id, amount)
    values (v_payment, v_item.id, v_take);
    v_left := v_left - v_take;
  end loop;

  perform app.refresh_invoices(v_invoices);
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'payment.recorded', 'payment', v_payment::text,
    jsonb_build_object('receipt_no', v_receipt, 'student_id', p_student_id,
      'amount', p_amount, 'method', p_method));
  perform set_config('edumise.payment', 'off', true);
  return jsonb_build_object('payment_id', v_payment, 'receipt_no', v_receipt);
end;
$$;
revoke execute on function public.record_payment(bigint, bigint[], bigint, public.payment_method, text, text)
  from public, anon;
grant execute on function public.record_payment(bigint, bigint[], bigint, public.payment_method, text, text)
  to authenticated;

/**
 * Cancels a payment (admins only, open question 41): the receipt keeps its number and
 * is marked cancelled, and its invoices owe that money again. A frozen late fine stays.
 * Errors: 42501 not allowed; 22023 no reason, no such payment or already cancelled.
 */
create function public.cancel_payment(p_id bigint, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_invoices bigint[];
begin
  if not app.is_admin() then
    raise exception 'only the office cancels a payment' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'give a reason' using errcode = '22023';
  end if;
  perform set_config('edumise.payment', 'on', true);
  select array_agg(distinct ii.invoice_id) into v_invoices
  from public.payment_allocations a join public.invoice_items ii on ii.id = a.invoice_item_id
  where a.payment_id = p_id;
  perform 1 from public.invoices where id = any (v_invoices) order by id for update;
  update public.payments set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_reason
  where id = p_id and cancelled_at is null;
  if not found then
    raise exception 'no such payment, or it is already cancelled' using errcode = '22023';
  end if;
  perform app.refresh_invoices(v_invoices);
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'payment.cancelled', 'payment', p_id::text,
    jsonb_build_object('reason', v_reason));
  perform set_config('edumise.payment', 'off', true);
end;
$$;
revoke execute on function public.cancel_payment(bigint, text) from public, anon;
grant execute on function public.cancel_payment(bigint, text) to authenticated;
