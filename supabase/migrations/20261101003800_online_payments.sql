-- Step 5.3: online payment, ready for a gateway (FEE-05). Switched off by default.
--
-- A guardian's "Pay now" creates a payment intent for what their child owes. The
-- gateway's webhook (/api/payments/webhook/[provider]) completes it with the server's
-- service role: once per gateway transaction, and only for the exact amount. The money
-- is then recorded like a payment at the office (same allocation and late-fine rules).

alter type public.payment_method add value if not exists 'online';

-- Online payment settings: only admins switch them (the accountant keeps the late fine).
alter table public.fee_settings
  add column online_payment_enabled boolean not null default false,
  add column payment_provider text not null default 'manual'
    check (payment_provider in ('manual', 'sandbox', 'bkash', 'nagad', 'sslcommerz'));

create function app.guard_online_payment_settings()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null and not app.is_admin()
     and (new.online_payment_enabled is distinct from old.online_payment_enabled
          or new.payment_provider is distinct from old.payment_provider) then
    raise exception 'only the office switches online payment' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger fee_settings_guard_online before update on public.fee_settings
  for each row execute function app.guard_online_payment_settings();

-- The payment logic of record_payment(), shared with online payments.
create function app.apply_payment(p_actor uuid, p_actor_name text, p_student_id bigint,
  p_item_ids bigint[], p_amount bigint, p_method public.payment_method, p_txn_id text, p_note text)
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
  if p_amount is null or p_amount <= 0 or coalesce(cardinality(p_item_ids), 0) = 0 then
    raise exception 'nothing to pay' using errcode = '22023';
  end if;
  if p_method::text in ('bkash', 'nagad', 'rocket', 'online') and v_txn is null then
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
    p_actor, p_actor_name)
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
  values (p_actor, 'payment.recorded', 'payment', v_payment::text,
    jsonb_build_object('receipt_no', v_receipt, 'student_id', p_student_id,
      'amount', p_amount, 'method', p_method));
  perform set_config('edumise.payment', 'off', true);
  return jsonb_build_object('payment_id', v_payment, 'receipt_no', v_receipt);
end;
$$;
revoke execute on function app.apply_payment(uuid, text, bigint, bigint[], bigint,
  public.payment_method, text, text) from public, anon, authenticated;

-- Collecting at the office: the same as before, now through apply_payment().
create or replace function public.record_payment(p_student_id bigint, p_item_ids bigint[],
  p_amount bigint, p_method public.payment_method, p_txn_id text, p_note text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.has_role('super_admin', 'admin', 'accountant') then
    raise exception 'only the office and the accountant collect fees' using errcode = '42501';
  end if;
  if p_method::text = 'online' then
    raise exception 'online payments come from the gateway' using errcode = '22023';
  end if;
  return app.apply_payment(auth.uid(),
    coalesce((select full_name_en from public.profiles where id = auth.uid()), ''),
    p_student_id, p_item_ids, p_amount, p_method, p_txn_id, p_note);
end;
$$;

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  student_id bigint not null references public.students (id) on delete restrict,
  item_ids bigint[] not null check (cardinality(item_ids) > 0),
  amount bigint not null check (amount > 0),
  provider text not null check (provider in ('manual', 'sandbox', 'bkash', 'nagad', 'sslcommerz')),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  provider_txn_id text check (char_length(provider_txn_id) between 1 and 100),
  payment_id bigint unique references public.payments (id) on delete restrict,
  failure_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A gateway transaction completes at most one intent (webhooks can arrive twice).
  unique (provider, provider_txn_id),
  check ((status = 'paid') = (payment_id is not null))
);
create index payment_intents_student_idx on public.payment_intents (student_id, created_at desc);
create trigger payment_intents_updated_at before update on public.payment_intents
  for each row execute function public.set_updated_at();
alter table public.payment_intents enable row level security;
create policy "admins and accountants read payment intents" on public.payment_intents
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));
create policy "students and guardians read own payment intents" on public.payment_intents
  for select to authenticated
  using (student_id = (select app.my_student_id())
    or student_id = any ((select app.guardian_student_ids())::bigint[]));

/**
 * A guardian (or the student) starts paying everything the student owes online: the
 * open items plus today's late fines. Earlier unfinished intents are closed. Errors:
 * 42501 not their child; 55000 online payment is switched off; 22023 nothing is due.
 */
create function public.create_payment_intent(p_student_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.fee_settings;
  v_today date := app.dhaka_today();
  v_items bigint[];
  v_amount bigint;
  v_id uuid;
begin
  -- coalesce: for a guardian my_student_id() is null, and "not null" would let anyone through.
  if not coalesce(p_student_id = app.my_student_id()
                  or p_student_id = any (app.guardian_student_ids()), false) then
    raise exception 'not your child' using errcode = '42501';
  end if;
  select * into v_rule from public.fee_settings where id = 1;
  if not v_rule.online_payment_enabled then
    raise exception 'online payment is switched off' using errcode = '55000';
  end if;
  select array_agg(b.id order by b.id), sum(b.outstanding) into v_items, v_amount
  from public.invoice_item_balances b
  join public.invoices i on i.id = b.invoice_id
  where b.student_id = p_student_id and b.outstanding > 0 and i.status in ('unpaid', 'partial');
  v_amount := coalesce(v_amount, 0) + coalesce((
    select sum(app.late_fine(v_rule.late_fine_per_day, v_rule.late_fine_cap, v_rule.grace_days,
      i.due_on, v_today, i.total - i.paid))
    from public.invoices i
    where i.student_id = p_student_id and i.status in ('unpaid', 'partial')
      and not exists (select 1 from public.invoice_items f where f.invoice_id = i.id and f.is_fine)), 0);
  if v_items is null or v_amount <= 0 then
    raise exception 'nothing is due' using errcode = '22023';
  end if;
  update public.payment_intents set status = 'failed', failure_reason = 'replaced'
  where student_id = p_student_id and status = 'created';
  insert into public.payment_intents (student_id, item_ids, amount, provider, created_by)
  values (p_student_id, v_items, v_amount, v_rule.payment_provider, auth.uid())
  returning id into v_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'payment_intent.created', 'payment_intent', v_id::text,
    jsonb_build_object('student_id', p_student_id, 'amount', v_amount, 'provider', v_rule.payment_provider));
  return jsonb_build_object('id', v_id, 'amount', v_amount, 'provider', v_rule.payment_provider);
end;
$$;
revoke execute on function public.create_payment_intent(bigint) from public, anon;
grant execute on function public.create_payment_intent(bigint) to authenticated;

/**
 * Completes an intent from a verified gateway webhook (server only, service role).
 * Returns 'recorded', 'duplicate' (the same gateway transaction again: nothing more is
 * recorded), 'mismatch' (wrong amount) or 'unrecordable' (the bills changed meanwhile); in
 * the last two the intent is marked failed, nothing is recorded and the office refunds.
 * Errors: 22023 unknown intent or wrong provider; 23505 the intent was already paid by
 * another transaction.
 */
create function public.complete_payment_intent(p_id uuid, p_provider text, p_txn text, p_amount bigint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_intent public.payment_intents;
  v_method public.payment_method;
  v_result jsonb;
begin
  select * into v_intent from public.payment_intents where id = p_id for update;
  if not found or v_intent.provider <> p_provider then
    raise exception 'unknown payment' using errcode = '22023';
  end if;
  if v_intent.status = 'paid' then
    if v_intent.provider_txn_id = p_txn then
      return 'duplicate';
    end if;
    raise exception 'already paid by another transaction' using errcode = '23505';
  end if;
  if p_amount is distinct from v_intent.amount then
    update public.payment_intents set status = 'failed', failure_reason = 'amount_mismatch',
      provider_txn_id = coalesce(provider_txn_id, p_txn) where id = p_id;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (null, 'payment_intent.amount_mismatch', 'payment_intent', p_id::text,
      jsonb_build_object('expected', v_intent.amount, 'received', p_amount, 'txn', p_txn));
    return 'mismatch';
  end if;
  v_method := case p_provider when 'bkash' then 'bkash' when 'nagad' then 'nagad'
    else 'online' end::public.payment_method;
  begin
    v_result := app.apply_payment(null, 'Online (' || p_provider || ')', v_intent.student_id,
      v_intent.item_ids, p_amount, v_method, regexp_replace(upper(p_txn), '[^A-Z0-9-]', '-', 'g'),
      'Paid online');
  exception when check_violation or invalid_parameter_value then
    -- The bills changed meanwhile (paid at the office, or cancelled): the money cannot be
    -- placed. Keep the gateway's ID so the office can refund it.
    update public.payment_intents set status = 'failed', failure_reason = 'cannot_record',
      provider_txn_id = coalesce(provider_txn_id, p_txn) where id = p_id;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (null, 'payment_intent.cannot_record', 'payment_intent', p_id::text,
      jsonb_build_object('amount', p_amount, 'txn', p_txn, 'error', sqlerrm));
    return 'unrecordable';
  end;
  update public.payment_intents set status = 'paid', provider_txn_id = p_txn,
    payment_id = (v_result ->> 'payment_id')::bigint, failure_reason = null
  where id = p_id;
  return 'recorded';
end;
$$;
revoke execute on function public.complete_payment_intent(uuid, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.complete_payment_intent(uuid, text, text, bigint) to service_role;

/** The gateway says the payment failed (server only). A paid intent stays paid. */
create function public.fail_payment_intent(p_id uuid, p_provider text, p_reason text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payment_intents set status = 'failed', failure_reason = left(p_reason, 200)
  where id = p_id and provider = p_provider and status = 'created';
$$;
revoke execute on function public.fail_payment_intent(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fail_payment_intent(uuid, text, text) to service_role;
