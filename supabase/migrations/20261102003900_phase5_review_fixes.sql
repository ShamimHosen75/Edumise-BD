-- Phase 5 code review fixes (docs/code-review-phase-5.md). Applied migrations are not
-- edited; functions are replaced here.

-- S1: invoices and their items change only through the database functions. Staff read
-- them; nobody writes them directly (no zeroing a bill, no waiver without an admin, no
-- "paid" invoice without a payment).
drop policy "admins and accountants manage invoices" on public.invoices;
drop policy "admins and accountants manage invoice_items" on public.invoice_items;
create policy "admins and accountants read invoices" on public.invoices
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));
create policy "admins and accountants read invoice items" on public.invoice_items
  for select to authenticated using ((select app.has_role('super_admin', 'admin', 'accountant')));

-- S7: internal helper, not callable by users.
revoke execute on function app.next_invoice_no(integer) from public, anon, authenticated;

-- P4: indexes for the invoice lists and the dues report.
create index invoices_session_idx on public.invoices (session_id, id desc);
create index invoices_open_idx on public.invoices (session_id, due_on)
  where status in ('unpaid', 'partial');

-- U2, C2: the receiver's name in both languages, and the gateway's own transaction ID.
alter table public.payments
  add column collected_by_name_bn text not null default '',
  add column gateway text check (gateway in ('sandbox', 'bkash', 'nagad', 'sslcommerz')),
  add column gateway_txn_id text check (char_length(gateway_txn_id) between 1 and 100);

/**
 * S2, C2, C4, C5, C6: the invoice generator works out every amount itself from the fee
 * structure (the student's group row, else the class row) and approved waivers (percents
 * added up to at most 100% and rounded down, then fixed; never below 0), as
 * src/lib/fees.ts does. p_rows: [{student_id, items: [{fee_head_id}]}]; amounts sent are
 * ignored. Skipped (counted in "skipped"): items already billed, an amount of 0 or none,
 * students who left or are not enrolled, students admitted after the billed month, and a
 * one-time head already billed for the session under the other kind of period (session
 * fee vs exam fee). Errors: 42501 not allowed; 22007 due date passed; 22023 bad period
 * (month outside the session, another session, an exam of another session) or a head
 * whose frequency does not fit.
 */
create or replace function public.create_invoices(p_session_id bigint, p_period_key text,
  p_due_on date, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.academic_sessions;
  v_monthly boolean;
  v_month_end date;
  v_row jsonb;
  v_student bigint;
  v_class bigint;
  v_group bigint;
  v_invoice bigint;
  v_items integer;
  v_asked integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_today date := app.dhaka_today();
begin
  if not app.has_role('super_admin', 'admin', 'accountant') then
    raise exception 'only the office and the accountant make invoices' using errcode = '42501';
  end if;
  select * into v_session from public.academic_sessions where id = p_session_id;
  if not found then
    raise exception 'no such session' using errcode = '22023';
  end if;
  if p_period_key ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_monthly := true;
    v_month_end := ((p_period_key || '-01')::date + interval '1 month' - interval '1 day')::date;
    if (p_period_key || '-01')::date > v_session.ends_on or v_month_end < v_session.starts_on then
      raise exception 'the month is outside the session' using errcode = '22023';
    end if;
  elsif p_period_key = 'session:' || p_session_id then
    v_monthly := false;
  elsif p_period_key ~ '^exam:[1-9]\d*$' and exists (
      select 1 from public.exams
      where id = substring(p_period_key from 6)::bigint and session_id = p_session_id) then
    v_monthly := false;
  else
    raise exception 'bad period' using errcode = '22023';
  end if;
  if p_due_on < v_today then
    raise exception 'the due date has passed' using errcode = '22007';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r, jsonb_array_elements(r -> 'items') i
    join public.fee_heads h on h.id = (i ->> 'fee_head_id')::bigint
    where (h.frequency = 'monthly') <> v_monthly or h.code = 'LATE_FINE') then
    raise exception 'fee head does not fit the period' using errcode = '22023';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_student := (v_row ->> 'student_id')::bigint;
    v_asked := jsonb_array_length(v_row -> 'items');
    select se.class_id, en.group_id into v_class, v_group
    from public.enrollments en
    join public.sections se on se.id = en.section_id
    join public.students st on st.id = en.student_id
    where en.student_id = v_student and en.session_id = p_session_id
      and st.status not in ('transferred', 'inactive')
      and (not v_monthly or st.admitted_on is null or st.admitted_on <= v_month_end);
    if not found then
      v_skipped := v_skipped + v_asked;
      continue;
    end if;
    insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, created_by)
    values (app.next_invoice_no(extract(year from v_today)::integer),
      v_student, p_session_id, v_today, p_due_on, auth.uid())
    returning id into v_invoice;
    insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, waiver)
    select v_invoice, v_student, a.head, p_period_key, a.gross,
      least(a.gross, (a.gross * least(100, w.percent)) / 100 + w.fixed)
    from (
      select h.head, coalesce(
        (select amount from public.fee_structures
         where session_id = p_session_id and class_id = v_class and fee_head_id = h.head
           and group_id = v_group),
        (select amount from public.fee_structures
         where session_id = p_session_id and class_id = v_class and fee_head_id = h.head
           and group_id is null)) as gross
      from (select distinct (i ->> 'fee_head_id')::bigint as head
            from jsonb_array_elements(v_row -> 'items') i) h
    ) a
    cross join lateral (
      select coalesce(sum(value) filter (where kind = 'percent'), 0) as percent,
        coalesce(sum(value) filter (where kind = 'fixed'), 0) as fixed
      from public.fee_waivers
      where student_id = v_student and session_id = p_session_id and fee_head_id = a.head
        and approved_at is not null
    ) w
    where a.gross > 0
      and (v_monthly or not exists (
        select 1 from public.invoice_items x join public.invoices iv on iv.id = x.invoice_id
        where x.student_id = v_student and x.fee_head_id = a.head and iv.session_id = p_session_id
          and split_part(x.period_key, ':', 1) <> split_part(p_period_key, ':', 1)))
    on conflict (student_id, fee_head_id, period_key) do nothing;
    get diagnostics v_items = row_count;
    v_skipped := v_skipped + v_asked - v_items;
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

/**
 * The payment logic, replacing the Step 5.3 version.
 * - C5: invoices are paid in order (oldest due date first); an invoice's late fine is
 *   frozen just before money reaches it, so an invoice that gets nothing keeps a live fine.
 * - C1, C7: p_fine_on is the day the fine is worked out for (today at the office; the day
 *   an online payment was started). p_expected, when given, is what the payer saw as owed
 *   (the ticked items and their invoices' fines): if the bills changed since, 22023.
 * - U2: the receiver's names in both languages; online payments have none.
 */
drop function app.apply_payment(uuid, text, bigint, bigint[], bigint, public.payment_method, text, text);
create function app.apply_payment(p_actor uuid, p_student_id bigint, p_item_ids bigint[],
  p_amount bigint, p_method public.payment_method, p_txn_id text, p_note text,
  p_fine_on date, p_expected bigint, p_gateway text, p_gateway_txn text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := app.dhaka_today();
  v_rule public.fee_settings;
  v_fine_head bigint;
  v_invoices bigint[];
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

  -- What is owed: the ticked items, their invoices' frozen fines, and the fines not yet frozen.
  select * into v_rule from public.fee_settings where id = 1;
  select id into v_fine_head from public.fee_heads where code = 'LATE_FINE';
  select coalesce(sum(b.outstanding), 0) into v_owed
  from public.invoice_item_balances b join public.invoice_items ii on ii.id = b.id
  where b.id = any (p_item_ids) or (ii.is_fine and ii.invoice_id = any (v_invoices));
  v_owed := v_owed + coalesce((
    select sum(app.late_fine(v_rule.late_fine_per_day, v_rule.late_fine_cap, v_rule.grace_days,
      i.due_on, p_fine_on, i.total - i.paid))
    from public.invoices i
    where i.id = any (v_invoices)
      and not exists (select 1 from public.invoice_items f where f.invoice_id = i.id and f.is_fine)), 0);
  if p_expected is not null and p_expected <> v_owed then
    raise exception 'the bills changed (now %)', v_owed using errcode = '22023';
  end if;
  if p_amount > v_owed then
    raise exception 'more than is owed (%)', v_owed using errcode = '23514';
  end if;

  v_receipt := app.next_receipt_no(extract(year from v_today)::integer);
  insert into public.payments (receipt_no, student_id, amount, method, txn_id, paid_on, note,
    collected_by, collected_by_name, collected_by_name_bn, gateway, gateway_txn_id)
  select v_receipt, p_student_id, p_amount, p_method, v_txn, v_today, btrim(coalesce(p_note, '')),
    p_actor, coalesce(pr.full_name_en, ''), coalesce(pr.full_name_bn, ''), p_gateway, p_gateway_txn
  from (select 1) one left join public.profiles pr on pr.id = p_actor
  returning id into v_payment;

  for v_inv in select id, due_on, total, paid from public.invoices
               where id = any (v_invoices) order by due_on, id loop
    exit when v_left = 0;
    if not exists (select 1 from public.invoice_items where invoice_id = v_inv.id and is_fine) then
      v_fine := app.late_fine(v_rule.late_fine_per_day, v_rule.late_fine_cap, v_rule.grace_days,
        v_inv.due_on, p_fine_on, v_inv.total - v_inv.paid);
      if v_fine > 0 then
        insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, is_fine)
        values (v_inv.id, p_student_id, v_fine_head, 'fine:' || v_inv.id, v_fine, true);
      end if;
    end if;
    for v_item in select b.id, b.outstanding from public.invoice_item_balances b
                  join public.invoice_items ii on ii.id = b.id
                  where ii.invoice_id = v_inv.id and (b.id = any (p_item_ids) or ii.is_fine)
                  order by ii.is_fine desc, ii.id loop
      exit when v_left = 0;
      v_take := least(v_left, greatest(v_item.outstanding, 0));
      continue when v_take = 0;
      insert into public.payment_allocations (payment_id, invoice_item_id, amount)
      values (v_payment, v_item.id, v_take);
      v_left := v_left - v_take;
    end loop;
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
revoke execute on function app.apply_payment(uuid, bigint, bigint[], bigint, public.payment_method,
  text, text, date, bigint, text, text) from public, anon, authenticated;

-- C7: the office sends what the screen showed as owed; a change since is refused.
drop function public.record_payment(bigint, bigint[], bigint, public.payment_method, text, text);
create function public.record_payment(p_student_id bigint, p_item_ids bigint[],
  p_amount bigint, p_method public.payment_method, p_txn_id text, p_note text,
  p_expected bigint default null)
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
  return app.apply_payment(auth.uid(), p_student_id, p_item_ids, p_amount, p_method, p_txn_id,
    p_note, app.dhaka_today(), p_expected, null, null);
end;
$$;
revoke execute on function public.record_payment(bigint, bigint[], bigint, public.payment_method,
  text, text, bigint) from public, anon;
grant execute on function public.record_payment(bigint, bigint[], bigint, public.payment_method,
  text, text, bigint) to authenticated;

-- S4: "Pay now" is for guardians (Step 5.3), not students.
create or replace function public.create_payment_intent(p_student_id bigint)
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
  if not coalesce(app.has_role('guardian') and p_student_id = any (app.guardian_student_ids()), false) then
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

/**
 * Completes an intent from a verified gateway webhook (service role only).
 * Returns 'recorded'; 'duplicate' (the same transaction again); 'mismatch' (wrong
 * amount); or 'unrecordable' (the bills changed since the payer started, or the intent was
 * already closed). Nothing is recorded in the last two, the intent stays or becomes failed,
 * and the gateway's ID is kept for the office to refund.
 * C1: the fine is worked out for the day the payment was started, and the amount must
 *   equal what is owed then (no silent part payment).
 * C2, C3: the gateway's ID is stored as given (gateway_txn_id); payments.txn_id holds a
 *   fixed-length digest of provider and ID, so IDs of any length or provider never clash.
 * C4: a failed intent is final: a later "paid" message records nothing.
 * Errors: 22023 unknown intent or wrong provider; 23505 the intent was paid by another
 * transaction.
 */
create or replace function public.complete_payment_intent(p_id uuid, p_provider text, p_txn text,
  p_amount bigint)
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
  if v_intent.status = 'failed' then
    if v_intent.provider_txn_id is null then
      update public.payment_intents set provider_txn_id = p_txn where id = p_id;
    end if;
    if v_intent.provider_txn_id is distinct from p_txn then
      insert into public.audit_log (actor_id, action, entity, entity_id, details)
      values (null, 'payment_intent.paid_after_close', 'payment_intent', p_id::text,
        jsonb_build_object('reason', v_intent.failure_reason, 'amount', p_amount, 'txn', p_txn));
    end if;
    return case when v_intent.failure_reason = 'amount_mismatch' then 'mismatch' else 'unrecordable' end;
  end if;
  if p_amount is distinct from v_intent.amount then
    update public.payment_intents set status = 'failed', failure_reason = 'amount_mismatch',
      provider_txn_id = p_txn where id = p_id;
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (null, 'payment_intent.amount_mismatch', 'payment_intent', p_id::text,
      jsonb_build_object('expected', v_intent.amount, 'received', p_amount, 'txn', p_txn));
    return 'mismatch';
  end if;
  v_method := case p_provider when 'bkash' then 'bkash' when 'nagad' then 'nagad'
    else 'online' end::public.payment_method;
  begin
    v_result := app.apply_payment(null, v_intent.student_id, v_intent.item_ids, p_amount, v_method,
      'GW-' || upper(substr(md5(p_provider || ':' || p_txn), 1, 32)), '',
      (v_intent.created_at at time zone 'Asia/Dhaka')::date, v_intent.amount, p_provider, p_txn);
  exception when check_violation or invalid_parameter_value or unique_violation then
    update public.payment_intents set status = 'failed', failure_reason = 'cannot_record',
      provider_txn_id = p_txn where id = p_id;
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
