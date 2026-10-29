-- Step 1.2: schema shape and data-integrity rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select tables_are('public', array[
  'school_settings', 'profiles',
  'academic_sessions', 'classes', 'groups', 'sections', 'subjects', 'class_subjects',
  'designations', 'staff', 'staff_private', 'students', 'guardians', 'student_guardians', 'enrollments',
  'teacher_assignments', 'governing_body',
  'notices', 'news', 'events', 'pages', 'sliders', 'gallery_albums', 'gallery_images', 'downloads',
  'periods', 'rooms', 'routine', 'attendance',
  'exams', 'exam_classes', 'exam_subjects', 'marks',
  'fee_heads', 'fee_structures', 'fee_waivers', 'invoices', 'invoice_items',
  'menu_items', 'site_links', 'page_attachments',
  'ex_principals', 'contact_messages',
  'admission_applications', 'admission_documents', 'tracking_counters', 'audit_log',
  'student_documents', 'exam_schedule', 'holidays', 'student_code_counters', 'mark_locks',
  'results', 'board_results'
], 'public schema has exactly the planned tables');

select views_are('public', array['public_staff'], 'public schema has exactly the planned views');

select is(
  (select array_agg(tablename::text order by tablename) from pg_tables
   where schemaname = 'public' and not rowsecurity),
  null,
  'every public table has row level security enabled'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'every public function has a fixed search_path'
);

select ok(
  (select coalesce(reloptions @> array['security_invoker=true'], false) from pg_class
   where oid = 'public.public_staff'::regclass),
  'public_staff runs with the reader''s permissions (security_invoker)'
);

-- school_settings is a single row.
select throws_ok($$ insert into public.school_settings (id, name_en) values (2, 'x') $$,
  '23514', null, 'school_settings allows only id = 1');
select throws_ok($$ update public.school_settings set primary_color = 'red' $$,
  '23514', null, 'primary_color must be a #RRGGBB hex value');

-- Only one current session.
select throws_ok($$ insert into public.academic_sessions (name, starts_on, ends_on, is_current)
  values ('2027', '2027-01-01', '2027-12-31', true) $$,
  '23505', null, 'only one academic session can be current');
select throws_ok($$ insert into public.academic_sessions (name, starts_on, ends_on)
  values ('bad', '2027-12-31', '2027-01-01') $$,
  '23514', null, 'a session must end after it starts');

select throws_ok($$ insert into public.classes (level, name_en) values (11, 'Class 11') $$,
  '23514', null, 'classes are limited to 6-10');

-- Groups only from Class 9.
select throws_ok($$ insert into public.class_subjects (class_id, group_id, subject_id)
  select (select id from public.classes where level = 6), (select id from public.groups where code = 'science'),
         (select id from public.subjects where code = 'PHY') $$,
  '23514', 'Groups apply only to Classes 9 and 10', 'groups are rejected for Class 6 subjects');

-- Roll is unique within a section and session.
select throws_ok($$ insert into public.enrollments (student_id, session_id, section_id, roll)
  select st.id, e.session_id, e.section_id, e.roll
  from public.enrollments e, public.students st
  where e.roll = 1 and st.full_name_en = 'Mim Akter' limit 1 $$,
  '23505', null, 'a roll number cannot repeat in the same section');

-- Phone, birth registration and NID formats.
select throws_ok($$ update public.guardians set phone = '0171234567' where full_name_en = 'Jamal Ahmed' $$,
  '23514', null, 'guardian phone must be 11-digit BD mobile');
select throws_ok($$ update public.students set birth_reg_no = '12345' where full_name_en = 'Rahim Ahmed' $$,
  '23514', null, 'birth registration number must be 17 digits');
select throws_ok($$ update public.staff_private set nid = 'ABC' where email = 'teacher@sunrise.test' $$,
  '23514', null, 'NID must be 10, 13 or 17 digits');

-- Notices: class audience needs a class; published needs a date.
select throws_ok($$ insert into public.notices (slug, title_en, audience) values ('x-class', 'x', 'class') $$,
  '23514', null, 'a class notice must name its class');
select throws_ok($$ insert into public.notices (slug, title_en, is_published) values ('x-pub', 'x', true) $$,
  '23514', null, 'a published notice must have published_at');
select throws_ok($$ insert into public.notices (slug, title_en) values ('Bad Slug', 'x') $$,
  '23514', null, 'slugs must be lowercase-with-dashes');

-- Marks cannot exceed full marks.
select throws_ok($$ update public.marks set cq = 71
  where exam_subject_id = (select es.id from public.exam_subjects es join public.subjects s on s.id = es.subject_id
                           where s.code = 'BAN' limit 1) $$,
  '23514', 'Marks exceed full marks for this part', 'CQ marks above full marks are rejected');
select throws_ok($$ update public.marks set is_absent = true where id = (select min(id) from public.marks) $$,
  '23514', null, 'an absent student cannot also have marks');

-- Routine clash backstop.
select throws_ok($$ insert into public.routine (session_id, section_id, day_of_week, period_id, subject_id, staff_id)
  select r.session_id, (select s.id from public.sections s join public.classes c on c.id = s.class_id
                         where c.level = 7 and s.name_en = 'A'), r.day_of_week, r.period_id, r.subject_id, r.staff_id
  from public.routine r limit 1 $$,
  '23505', null, 'a teacher cannot be in two sections in the same period');

-- Money.
select throws_ok($$ update public.fee_structures set amount = -1 where id = (select min(id) from public.fee_structures) $$,
  '23514', null, 'fee amounts cannot be negative');
select throws_ok($$ update public.fee_waivers set value = 101 $$,
  '23514', null, 'a percent waiver cannot exceed 100');
select throws_ok($$ insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross)
  select invoice_id, student_id, fee_head_id, period_key, gross from public.invoice_items limit 1 $$,
  '23505', null, 'a student cannot be billed twice for the same head and period');
select throws_ok($$ update public.invoices set paid = total + 1 where id = (select min(id) from public.invoices) $$,
  '23514', null, 'paid cannot exceed the invoice total');

select * from finish();
rollback;
