-- Fee setup demo data (Step 5.1): late fine Tk 10/day up to Tk 100, more fee heads,
-- a science-group amount for Classes 9-10, and a waiver waiting for an admin.
update public.fee_settings set late_fine_per_day = 1000, late_fine_cap = 10000, grace_days = 0, due_days = 15;

insert into public.fee_heads (code, name_en, name_bn, frequency, sort_order) values
  ('LAB', 'Lab fee', 'ল্যাব ফি', 'one_time', 5),
  ('ICT', 'ICT fee', 'আইসিটি ফি', 'one_time', 6),
  ('SPORTS', 'Sports fee', 'ক্রীড়া ফি', 'one_time', 7),
  ('TRANSPORT', 'Transport', 'যাতায়াত', 'monthly', 8);

-- Science students in Classes 9-10 pay Tk 900 tuition and a lab fee.
insert into public.fee_structures (session_id, class_id, group_id, fee_head_id, amount)
select se.id, c.id, g.id, h.id, case h.code when 'TUITION' then 90000 else 30000 end
from public.academic_sessions se, public.classes c, public.groups g, public.fee_heads h
where se.is_current and c.level >= 9 and g.code = 'science' and h.code in ('TUITION', 'LAB');

insert into public.fee_structures (session_id, class_id, group_id, fee_head_id, amount)
select se.id, c.id, null, h.id, case h.code when 'ICT' then 20000 else 15000 end
from public.academic_sessions se, public.classes c, public.fee_heads h
where se.is_current and h.code in ('ICT', 'SPORTS');

-- Entered by the accountant, waiting for an admin: half tuition for Mim Akter.
insert into public.fee_waivers (student_id, session_id, fee_head_id, kind, value, reason)
select st.id, se.id, h.id, 'percent', 50, 'Half free (poor fund)'
from public.students st, public.academic_sessions se, public.fee_heads h
where st.full_name_en = 'Mim Akter' and se.is_current and h.code = 'TUITION';
