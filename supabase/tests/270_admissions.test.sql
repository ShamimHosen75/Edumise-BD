-- Step 3.3: online admission.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Tracking numbers count up per year (server only).
select matches(public.next_tracking_no(), '^ADM-[0-9]{4}-[0-9]{5}$', 'tracking numbers look like ADM-YYYY-00001');
select isnt(public.next_tracking_no(), public.next_tracking_no(), 'each tracking number is new');

insert into public.admission_applications (
  tracking_no, session_id, class_id, student_name_en, birth_date, gender, birth_reg_no,
  father_name, mother_name, guardian_phone, present_address
) values (
  'ADM-2026-99901', (select id from public.academic_sessions where is_current),
  (select id from public.classes where level = 6), 'T Applicant', '2014-03-15', 'female',
  '20143512345678901', 'T Father', 'T Mother', '01799990001', 'Road 1'
);
select throws_ok($$ insert into public.admission_applications (tracking_no, session_id, class_id, student_name_en,
  birth_date, gender, birth_reg_no, father_name, mother_name, guardian_phone, present_address)
  values ('ADM-2026-99902', 1, 1, 'x', '2014-01-01', 'male', '123', 'f', 'm', '01799990002', 'r') $$,
  '23514', null, 'birth registration numbers have 17 digits');
select throws_ok($$ insert into public.admission_documents (application_id, kind, file_path, mime_type, file_size)
  select id, 'birth_certificate', 'admissions/1/../../x.pdf', 'application/pdf', 10 from public.admission_applications limit 1 $$,
  '23514', null, 'document paths stay inside the application folder');

-- Visitors cannot read or write applications, documents or counters.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.admission_applications), 0, 'anon cannot read applications');
select is((select count(*)::int from public.admission_documents), 0, 'anon cannot read application documents');
select throws_ok($$ insert into public.admission_applications (tracking_no, session_id, class_id, student_name_en,
  birth_date, gender, birth_reg_no, father_name, mother_name, guardian_phone, present_address)
  values ('ADM-2026-99903', 1, 1, 'x', '2014-01-01', 'male', '20143512345678909', 'f', 'm', '01799990003', 'r') $$,
  '42501', null, 'anon cannot write applications directly');
select throws_ok($$ select public.next_tracking_no() $$, '42501', null, 'anon cannot take tracking numbers');

-- Teachers cannot read the queue or approve.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated", "app_role": "teacher"}';
select is((select count(*)::int from public.admission_applications), 0, 'a teacher cannot read applications');
select throws_ok($$ select * from public.approve_admission(
  (select id from public.admission_applications where tracking_no = 'ADM-2026-99901'), 1) $$,
  '42501', null, 'a teacher cannot approve');

-- Admin approves in one transaction.
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated", "app_role": "admin"}';
select throws_ok($$ select * from public.approve_admission(
  (select id from public.admission_applications where tracking_no = 'ADM-2026-99901'),
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 7 limit 1)) $$,
  '23514', null, 'the section must be in the applied class');
create temporary table approved as
select * from public.approve_admission(
  (select id from public.admission_applications where tracking_no = 'ADM-2026-99901'),
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'B'));
select matches((select student_code from approved), '^[0-9]{4}06[0-9]{4}$', 'student ID is year + class + serial');
select is((select roll from approved),
  (select max(roll) from public.enrollments e join public.sections s on s.id = e.section_id
   join public.classes c on c.id = s.class_id where c.level = 6 and s.name_en = 'B'),
  'the student gets the next (highest) roll');
select is((select count(*)::int from public.student_guardians where student_id = (select student_id from approved)), 2,
  'father and mother are linked');
select is((select status::text from public.admission_applications where tracking_no = 'ADM-2026-99901'), 'approved',
  'the application is approved');
select is((select count(*)::int from public.audit_log where action = 'admission.approved'
  and entity_id = (select id::text from public.admission_applications where tracking_no = 'ADM-2026-99901')), 1,
  'the approval is in the audit log');
select throws_ok($$ select * from public.approve_admission(
  (select id from public.admission_applications where tracking_no = 'ADM-2026-99901'),
  (select s.id from public.sections s join public.classes c on c.id = s.class_id where c.level = 6 limit 1)) $$,
  '23505', null, 'an application is approved only once');
select lives_ok($$ select public.record_audit('test', 'thing', '1', '{}') $$, 'admins write the audit log');

select * from finish();
rollback;
