-- Demo data (part 1 of 3) for a fictional school: "Sunrise High School".
-- Every name, number and address here is made up.
-- Demo logins (password for all: Password123!):
--   superadmin@sunrise.test  admin@sunrise.test  teacher@sunrise.test
--   accountant@sunrise.test  student@sunrise.test  guardian@sunrise.test

-- ---------------------------------------------------------------- logins
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
    'app_role', u.app_role, 'phone', u.phone, 'full_name_en', u.name_en, 'full_name_bn', u.name_bn),
  '{}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'superadmin@sunrise.test', 'super_admin', '01710000001', 'System Administrator', 'সিস্টেম অ্যাডমিনিস্ট্রেটর'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'admin@sunrise.test',      'admin',       '01710000002', 'Nasrin Akter',         'নাসরিন আক্তার'),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'teacher@sunrise.test',    'teacher',     '01710000003', 'Kamal Hossain',        'কামাল হোসেন'),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'accountant@sunrise.test', 'accountant',  '01710000004', 'Rafiq Uddin',          'রফিক উদ্দিন'),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'student@sunrise.test',    'student',     null,          'Rahim Ahmed',          'রহিম আহমেদ'),
  ('00000000-0000-4000-a000-000000000006'::uuid, 'guardian@sunrise.test',   'guardian',    '01810000006', 'Jamal Ahmed',          'জামাল আহমেদ')
) as u(id, email, app_role, phone, name_en, name_bn);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email like '%@sunrise.test';

-- Demo users can log in straight away.
update public.profiles set must_change_password = false;

-- ---------------------------------------------------------------- settings
insert into public.school_settings (
  name_en, name_bn, short_name, address_en, address_bn, phone, email, website_url,
  facebook_url, office_hours_en, office_hours_bn, eiin, institution_code, center_code,
  established_year, head_name_en, head_name_bn, head_message_en, head_message_bn
) values (
  'Sunrise High School', 'সানরাইজ হাই স্কুল', 'SHS',
  '12 Lake Road, Demo Town', '১২ লেক রোড, ডেমো টাউন',
  '01700000000', 'info@sunrise.test', 'https://sunrise.test',
  '', 'Saturday–Thursday, 8:00 am – 3:00 pm', 'শনিবার–বৃহস্পতিবার, সকাল ৮টা – বিকেল ৩টা',
  '999999', '9999', '999', 1975,
  'Abdul Karim', 'আব্দুল করিম',
  'Welcome to Sunrise High School. We help every student learn, grow and lead.',
  'সানরাইজ হাই স্কুলে স্বাগতম। আমরা প্রতিটি শিক্ষার্থীকে শিখতে, বেড়ে উঠতে ও নেতৃত্ব দিতে সাহায্য করি।'
);

-- ---------------------------------------------------------------- academic
insert into public.academic_sessions (name, starts_on, ends_on, is_current)
values ('2026', '2026-01-01', '2026-12-31', true);

insert into public.classes (level, name_en, name_bn) values
  (6, 'Class 6', 'ষষ্ঠ শ্রেণি'), (7, 'Class 7', 'সপ্তম শ্রেণি'), (8, 'Class 8', 'অষ্টম শ্রেণি'),
  (9, 'Class 9', 'নবম শ্রেণি'), (10, 'Class 10', 'দশম শ্রেণি');

insert into public.groups (code, name_en, name_bn) values
  ('science', 'Science', 'বিজ্ঞান'),
  ('business', 'Business Studies', 'ব্যবসায় শিক্ষা'),
  ('humanities', 'Humanities', 'মানবিক');

insert into public.sections (class_id, name_en, name_bn, capacity)
select c.id, s.name_en, s.name_bn, 50
from public.classes c
cross join (values ('A', 'ক'), ('B', 'খ')) as s(name_en, name_bn);

insert into public.subjects (code, name_en, name_bn, type, sort_order) values
  ('BAN',  'Bangla',              'বাংলা',               'compulsory', 1),
  ('ENG',  'English',             'ইংরেজি',              'compulsory', 2),
  ('MATH', 'Mathematics',         'গণিত',                'compulsory', 3),
  ('SCI',  'Science',             'বিজ্ঞান',              'compulsory', 4),
  ('ICT',  'ICT',                 'তথ্য ও যোগাযোগ প্রযুক্তি', 'compulsory', 5),
  ('REL',  'Religion',            'ধর্ম',                 'compulsory', 6),
  ('PHY',  'Physics',             'পদার্থবিজ্ঞান',          'compulsory', 7),
  ('CHE',  'Chemistry',           'রসায়ন',               'compulsory', 8),
  ('BIO',  'Biology',             'জীববিজ্ঞান',            'compulsory', 9),
  ('ACC',  'Accounting',          'হিসাববিজ্ঞান',           'compulsory', 10),
  ('FIN',  'Finance and Banking', 'ফিন্যান্স ও ব্যাংকিং',     'compulsory', 11),
  ('HIST', 'History',             'ইতিহাস',              'compulsory', 12),
  ('GEO',  'Geography',           'ভূগোল',               'compulsory', 13),
  ('HMATH','Higher Mathematics',  'উচ্চতর গণিত',          'fourth',     14),
  ('AGRI', 'Agriculture',         'কৃষিশিক্ষা',            'fourth',     15);

-- Classes 6-8: common subjects, no group.
insert into public.class_subjects (class_id, subject_id)
select c.id, s.id from public.classes c, public.subjects s
where c.level between 6 and 8 and s.code in ('BAN', 'ENG', 'MATH', 'SCI', 'ICT', 'REL');

-- Classes 9-10: common subjects plus group subjects.
insert into public.class_subjects (class_id, group_id, subject_id)
select c.id, g.id, s.id
from public.classes c
cross join public.groups g
join public.subjects s on s.code = any (
  array['BAN', 'ENG', 'MATH', 'ICT', 'REL'] || case g.code
    when 'science' then array['PHY', 'CHE', 'BIO', 'HMATH']
    when 'business' then array['ACC', 'FIN', 'AGRI']
    else array['HIST', 'GEO', 'AGRI']
  end)
where c.level between 9 and 10;

-- ---------------------------------------------------------------- staff
insert into public.designations (name_en, name_bn, rank, is_teaching) values
  ('Head Teacher', 'প্রধান শিক্ষক', 1, true),
  ('Assistant Head Teacher', 'সহকারী প্রধান শিক্ষক', 2, true),
  ('Senior Teacher', 'সিনিয়র শিক্ষক', 3, true),
  ('Assistant Teacher', 'সহকারী শিক্ষক', 4, true),
  ('Instructor', 'ইন্সট্রাক্টর', 5, true),
  ('Staff', 'কর্মচারী', 6, false);

create temporary table seed_staff (
  profile_id uuid, designation text, name_en text, name_bn text, subject_en text, subject_bn text,
  qual text, joined text, left_on text, sort_order int, nid text, dob text, address text, phone text, email text
);
insert into seed_staff values
  (null::uuid, 'Head Teacher', 'Abdul Karim', 'আব্দুল করিম', 'Bangla', 'বাংলা', 'MA (Bangla), B.Ed', '2005-01-01', null, 1, '1990000000001', '1970-03-15', 'Staff Quarter 1, Demo Town', '01910000001', 'head@sunrise.test'),
  ('00000000-0000-4000-a000-000000000002', 'Assistant Head Teacher', 'Nasrin Akter', 'নাসরিন আক্তার', 'English', 'ইংরেজি', 'MA (English), B.Ed', '2008-01-01', null, 2, '1990000000002', '1975-07-21', 'House 5, Demo Town', '01910000002', 'admin@sunrise.test'),
  ('00000000-0000-4000-a000-000000000003', 'Senior Teacher', 'Kamal Hossain', 'কামাল হোসেন', 'Mathematics', 'গণিত', 'MSc (Mathematics), B.Ed', '2012-01-01', null, 3, '1990000000003', '1982-11-02', 'House 9, Demo Town', '01910000003', 'teacher@sunrise.test'),
  (null, 'Assistant Teacher', 'Shirin Sultana', 'শিরিন সুলতানা', 'Science', 'বিজ্ঞান', 'BSc (Physics), B.Ed', '2016-01-01', null, 4, '1990000000004', '1988-05-10', 'House 14, Demo Town', '01910000004', 'shirin@sunrise.test'),
  (null, 'Assistant Teacher', 'Habibur Rahman', 'হাবিবুর রহমান', 'ICT', 'আইসিটি', 'BSc (CSE)', '2019-01-01', null, 5, '1990000000005', '1991-09-30', 'House 20, Demo Town', '01910000005', 'habib@sunrise.test'),
  ('00000000-0000-4000-a000-000000000004', 'Staff', 'Rafiq Uddin', 'রফিক উদ্দিন', '', '', 'BCom', '2015-01-01', null, 6, '1990000000006', '1985-01-25', 'House 3, Demo Town', '01910000006', 'accountant@sunrise.test'),
  (null, 'Senior Teacher', 'Mohammad Ali', 'মোহাম্মদ আলী', 'Religion', 'ধর্ম', 'Kamil', '1995-01-01', '2024-12-31', 7, '1990000000007', '1964-02-14', 'Old Town Road', '01910000007', null)
;

insert into public.staff (
  profile_id, designation_id, full_name_en, full_name_bn, subject_en, subject_bn,
  qualification_en, joined_on, left_on, sort_order
)
select p.profile_id, d.id, p.name_en, p.name_bn, p.subject_en, p.subject_bn, p.qual,
  p.joined::date, p.left_on::date, p.sort_order
from seed_staff p
join public.designations d on d.name_en = p.designation;

insert into public.staff_private (staff_id, nid, birth_date, address, personal_phone, email)
select s.id, p.nid, p.dob::date, p.address, p.phone, p.email
from seed_staff p
join public.staff s on s.full_name_en = p.name_en;

drop table seed_staff;

-- Class teachers: Kamal for 6A, Shirin for 9A.
update public.sections set class_teacher_id = (select id from public.staff where full_name_en = 'Kamal Hossain')
where name_en = 'A' and class_id = (select id from public.classes where level = 6);
update public.sections set class_teacher_id = (select id from public.staff where full_name_en = 'Shirin Sultana')
where name_en = 'A' and class_id = (select id from public.classes where level = 9);

insert into public.governing_body (full_name_en, full_name_bn, position_en, position_bn, term_start, term_end, sort_order) values
  ('Md. Anwar Hossain', 'মোঃ আনোয়ার হোসেন', 'Chairman', 'সভাপতি', '2025-01-01', null, 1),
  ('Abdul Karim', 'আব্দুল করিম', 'Member Secretary', 'সদস্য সচিব', '2025-01-01', null, 2),
  ('Fatema Begum', 'ফাতেমা বেগম', 'Guardian Member', 'অভিভাবক সদস্য', '2025-01-01', null, 3),
  ('Md. Salim Reza', 'মোঃ সেলিম রেজা', 'Chairman', 'সভাপতি', '2022-01-01', '2024-12-31', 1);
