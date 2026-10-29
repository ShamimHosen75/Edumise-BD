-- Step 1.3: accountant (fees full, students read-only).
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(14);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000004", "role": "authenticated"}';

-- Allowed
select is(app.auth_role(), 'accountant', 'accountant is recognised');
select is((select count(*)::int from public.students), 20, 'accountant reads all students');
select is((select count(*)::int from public.guardians), 19, 'accountant reads guardians (for dues follow-up)');
select is((select count(*)::int from public.invoices), 3, 'accountant reads all invoices');
select lives_ok($$ insert into public.fee_heads (code, name_en, frequency) values ('LIBRARY', 'Library fee', 'one_time') $$,
  'accountant creates fee heads');
select is(pg_temp.affected($$ update public.invoices set due_on = due_on + 1 $$), 3, 'accountant updates invoices');
select lives_ok($$ update public.fee_structures set amount = amount + 100 $$, 'accountant edits the fee structure');

-- Forbidden
select is(pg_temp.affected($$ update public.students set full_name_en = 'x' $$), 0,
  'accountant cannot edit students');
select throws_ok($$ insert into public.students (student_code, full_name_en, gender) values ('X1', 'x', 'male') $$,
  '42501', null, 'accountant cannot add students');
select is((select count(*)::int from public.attendance), 0, 'accountant cannot read attendance');
select is((select count(*)::int from public.marks), 0, 'accountant cannot read marks');
select throws_ok($$ insert into public.attendance (student_id, section_id, date, status)
  select e.student_id, e.section_id, '2026-10-24', 'present' from public.enrollments e limit 1 $$,
  '42501', null, 'accountant cannot mark attendance');
select is((select count(*)::int from public.staff_private), 1, 'accountant reads only own private fields');
select is(pg_temp.affected($$ update public.school_settings set name_en = 'x' $$), 0,
  'accountant cannot change school settings');

select * from finish();
rollback;
