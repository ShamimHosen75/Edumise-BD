-- Fee collection demo data (Step 5.2): the paid and part-paid October tuition invoices
-- get their receipts. Rahim paid Tk 300 in cash; Ayesha Tk 200 by bKash.
insert into public.payments (receipt_no, student_id, amount, method, txn_id, paid_on, note,
  collected_by, collected_by_name)
select format('RCP-2026-%s', lpad(i.id::text, 6, '0')), i.student_id, i.paid,
  (case i.status when 'paid' then 'cash' else 'bkash' end)::public.payment_method,
  case i.status when 'paid' then null else 'BK7Q2M9XA4' end,
  '2026-10-10', '', '00000000-0000-4000-a000-000000000004', 'Rafiq Uddin'
from public.invoices i where i.invoice_no in ('INV-2026-00001', 'INV-2026-00002') order by i.id;

insert into public.payment_allocations (payment_id, invoice_item_id, amount)
select p.id, ii.id, p.amount
from public.payments p
join public.invoice_items ii on ii.student_id = p.student_id and ii.period_key = '2026-10';

insert into public.receipt_counters (year, last_no)
select 2026, count(*) from public.payments;
