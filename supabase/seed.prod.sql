-- Production seed (Step 6.4): settings placeholders, the grading scale (the table's
-- default, Bangladesh SSC), and an EMPTY structure for a Bangladeshi secondary school:
-- classes 6-10, groups, subjects, designations, periods, fee heads, the website menu
-- and empty draft pages. No people, no session, no demo content.
--
-- Run ONCE on a fresh project, after the migrations (docs/deploy.md):
--   psql "$DATABASE_URL" -f supabase/seed.prod.sql
-- The demo seed (supabase/seed.sql + seeds/) is for local development and demo sites.

begin;

-- ---------------------------------------------------------------- settings
-- Placeholders: the office fills these in at Dashboard -> School settings (Step 1.5).
insert into public.school_settings (name_en, name_bn, short_name, office_hours_en, office_hours_bn)
values ('School name', 'বিদ্যালয়ের নাম', 'SCHOOL',
  'Saturday–Thursday, 8:00 am – 3:00 pm', 'শনিবার–বৃহস্পতিবার, সকাল ৮টা – বিকেল ৩টা')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- academic structure
insert into public.classes (level, name_en, name_bn) values
  (6, 'Class 6', 'ষষ্ঠ শ্রেণি'), (7, 'Class 7', 'সপ্তম শ্রেণি'), (8, 'Class 8', 'অষ্টম শ্রেণি'),
  (9, 'Class 9', 'নবম শ্রেণি'), (10, 'Class 10', 'দশম শ্রেণি')
on conflict do nothing;

insert into public.groups (code, name_en, name_bn) values
  ('science', 'Science', 'বিজ্ঞান'),
  ('business', 'Business Studies', 'ব্যবসায় শিক্ষা'),
  ('humanities', 'Humanities', 'মানবিক')
on conflict do nothing;

-- One section per class to start with; the office adds more (Academic setup -> Sections).
insert into public.sections (class_id, name_en, name_bn, capacity)
select c.id, 'A', 'ক', 60 from public.classes c
on conflict do nothing;

insert into public.subjects (code, name_en, name_bn, type, sort_order) values
  ('BAN',  'Bangla',              'বাংলা',               'compulsory', 1),
  ('ENG',  'English',             'ইংরেজি',              'compulsory', 2),
  ('MATH', 'Mathematics',         'গণিত',                'compulsory', 3),
  ('SCI',  'Science',             'বিজ্ঞান',              'compulsory', 4),
  ('BGS',  'Bangladesh and Global Studies', 'বাংলাদেশ ও বিশ্বপরিচয়', 'compulsory', 5),
  ('ICT',  'ICT',                 'তথ্য ও যোগাযোগ প্রযুক্তি', 'compulsory', 6),
  ('REL',  'Religion and Moral Education', 'ধর্ম ও নৈতিক শিক্ষা', 'compulsory', 7),
  ('PHY',  'Physics',             'পদার্থবিজ্ঞান',          'compulsory', 8),
  ('CHE',  'Chemistry',           'রসায়ন',               'compulsory', 9),
  ('BIO',  'Biology',             'জীববিজ্ঞান',            'compulsory', 10),
  ('ACC',  'Accounting',          'হিসাববিজ্ঞান',           'compulsory', 11),
  ('FIN',  'Finance and Banking', 'ফিন্যান্স ও ব্যাংকিং',     'compulsory', 12),
  ('BENT', 'Business Entrepreneurship', 'ব্যবসায় উদ্যোগ',   'compulsory', 13),
  ('HIST', 'History of Bangladesh and World Civilization', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 'compulsory', 14),
  ('GEO',  'Geography and Environment', 'ভূগোল ও পরিবেশ',   'compulsory', 15),
  ('CIV',  'Civics and Citizenship', 'পৌরনীতি ও নাগরিকতা', 'compulsory', 16),
  ('HMATH','Higher Mathematics',  'উচ্চতর গণিত',          'fourth',     17),
  ('AGRI', 'Agriculture Studies', 'কৃষিশিক্ষা',            'fourth',     18),
  ('HSC',  'Home Science',        'গার্হস্থ্য বিজ্ঞান',       'fourth',     19)
on conflict do nothing;

-- Classes 6-8: common subjects, no group.
insert into public.class_subjects (class_id, subject_id)
select c.id, s.id from public.classes c, public.subjects s
where c.level between 6 and 8 and s.code in ('BAN', 'ENG', 'MATH', 'SCI', 'BGS', 'ICT', 'REL')
on conflict do nothing;

-- Classes 9-10: common subjects plus the group's subjects and fourth subjects.
insert into public.class_subjects (class_id, group_id, subject_id)
select c.id, g.id, s.id
from public.classes c
cross join public.groups g
join public.subjects s on s.code = any (
  array['BAN', 'ENG', 'MATH', 'ICT', 'REL', 'BGS'] || case g.code
    when 'science' then array['PHY', 'CHE', 'BIO', 'HMATH', 'AGRI']
    when 'business' then array['ACC', 'FIN', 'BENT', 'AGRI', 'HSC']
    else array['HIST', 'GEO', 'CIV', 'AGRI', 'HSC']
  end)
where c.level between 9 and 10
on conflict do nothing;

-- ---------------------------------------------------------------- staff designations
insert into public.designations (name_en, name_bn, rank, is_teaching) values
  ('Head Teacher', 'প্রধান শিক্ষক', 1, true),
  ('Assistant Head Teacher', 'সহকারী প্রধান শিক্ষক', 2, true),
  ('Senior Teacher', 'সিনিয়র শিক্ষক', 3, true),
  ('Assistant Teacher', 'সহকারী শিক্ষক', 4, true),
  ('Instructor', 'ইন্সট্রাক্টর', 5, true),
  ('Office Staff', 'অফিস কর্মচারী', 6, false)
on conflict do nothing;

-- ---------------------------------------------------------------- routine periods
insert into public.periods (number, starts_at, ends_at, is_break) values
  (1, '10:00', '10:45', false), (2, '10:45', '11:30', false), (3, '11:30', '12:15', false),
  (4, '12:15', '13:00', false), (5, '13:00', '13:30', true),  (6, '13:30', '14:15', false),
  (7, '14:15', '15:00', false), (8, '15:00', '15:45', false)
on conflict do nothing;

-- ---------------------------------------------------------------- fees
insert into public.fee_heads (code, name_en, name_bn, frequency, sort_order) values
  ('ADMISSION', 'Admission fee', 'ভর্তি ফি', 'one_time', 1),
  ('SESSION',   'Session fee',   'সেশন ফি',  'one_time', 2),
  ('TUITION',   'Monthly tuition', 'মাসিক বেতন', 'monthly', 3),
  ('EXAM',      'Exam fee',      'পরীক্ষা ফি', 'one_time', 4)
on conflict (code) do nothing;
-- (The LATE_FINE head exists from the migrations; late fine amounts: Fees -> Late fine.)

-- ---------------------------------------------------------------- website skeleton
-- Draft pages for the usual menus (published by the office once written) and the menu.
create temporary table seed_pages (menu text, sort_order int, slug text, title_en text, title_bn text);
insert into seed_pages values
  ('About', 1, 'about-us', 'About us', 'আমাদের সম্পর্কে'),
  ('About', 2, 'history', 'History', 'ইতিহাস'),
  ('About', 3, 'mission-vision', 'Mission and vision', 'লক্ষ্য ও উদ্দেশ্য'),
  ('About', 4, 'chairman-message', 'Chairman''s message', 'সভাপতির বাণী'),
  ('About', 5, 'principal-message', 'Head teacher''s message', 'প্রধান শিক্ষকের বাণী'),
  ('Information', 1, 'rules', 'Rules and regulations', 'নিয়মকানুন'),
  ('Information', 2, 'uniform', 'School uniform', 'স্কুল ইউনিফর্ম'),
  ('Information', 3, 'daily-activities', 'Daily activities', 'দৈনন্দিন কার্যক্রম'),
  ('Academic', 1, 'academic-rules', 'Academic rules', 'একাডেমিক নিয়মাবলি'),
  ('Academic', 2, 'exam-system', 'Examination system', 'পরীক্ষা পদ্ধতি'),
  ('Academic', 3, 'co-curricular', 'Co-curricular activities', 'সহশিক্ষা কার্যক্রম'),
  ('Admission', 1, 'how-to-apply', 'How to apply', 'কীভাবে আবেদন করবেন'),
  ('Admission', 2, 'admission-policy', 'Admission policy', 'ভর্তি নীতিমালা'),
  ('Admission', 3, 'tuition-fees', 'Tuition fees', 'বেতন ও ফি'),
  ('Facilities', 1, 'library', 'Library', 'গ্রন্থাগার'),
  ('Facilities', 2, 'playground', 'Playground', 'খেলার মাঠ'),
  ('Facilities', 3, 'ict-lab', 'ICT lab', 'আইসিটি ল্যাব');

insert into public.pages (slug, title_en, title_bn, body_en, body_bn, is_published)
select slug, title_en, title_bn, '', '', false from seed_pages
on conflict (slug) do nothing;

insert into public.menu_items (label_en, label_bn, url, sort_order) values
  ('Home', 'হোম', '/', 1),
  ('About', 'আমাদের সম্পর্কে', null, 2),
  ('Information', 'তথ্য', null, 3),
  ('Academic', 'একাডেমিক', null, 4),
  ('Admission', 'ভর্তি', null, 5),
  ('Facilities', 'সুবিধাসমূহ', null, 6),
  ('Result', 'ফলাফল', null, 7),
  ('Others', 'অন্যান্য', null, 8),
  ('Contact', 'যোগাযোগ', '/contact', 9);

insert into public.menu_items (parent_id, label_en, label_bn, page_id, sort_order)
select m.id, sp.title_en, sp.title_bn, p.id, sp.sort_order
from seed_pages sp
join public.menu_items m on m.label_en = sp.menu and m.parent_id is null
join public.pages p on p.slug = sp.slug;
drop table seed_pages;

insert into public.menu_items (parent_id, label_en, label_bn, url, sort_order)
select m.id, i.label_en, i.label_bn, i.url, i.sort_order
from (values
  ('About', 'Governing body', 'পরিচালনা পর্ষদ', '/governing-body', 21),
  ('About', 'Former head teachers', 'প্রাক্তন প্রধান শিক্ষক', '/ex-principals', 22),
  ('About', 'Teachers and staff', 'শিক্ষক ও কর্মচারী', '/teachers', 23),
  ('Information', 'Notices', 'নোটিশ', '/notices', 21),
  ('Information', 'News', 'সংবাদ', '/news', 22),
  ('Information', 'Events', 'অনুষ্ঠান', '/events', 23),
  ('Academic', 'Class routine', 'ক্লাস রুটিন', '/routine', 21),
  ('Academic', 'Exam routine', 'পরীক্ষার রুটিন', '/exam-routine', 22),
  ('Academic', 'Academic calendar', 'একাডেমিক ক্যালেন্ডার', '/calendar', 23),
  ('Admission', 'Apply online', 'অনলাইনে আবেদন', '/admission/apply', 21),
  ('Admission', 'Application status', 'আবেদনের অবস্থা', '/admission/status', 22),
  ('Result', 'Find a result', 'ফলাফল খুঁজুন', '/result', 21),
  ('Result', 'Board exam results', 'বোর্ড পরীক্ষার ফলাফল', '/board-results', 22),
  ('Others', 'Gallery', 'গ্যালারি', '/gallery', 21),
  ('Others', 'Downloads', 'ডাউনলোড', '/downloads', 22),
  ('Others', 'Verify a certificate', 'সনদ যাচাই', '/verify', 23)
) as i(menu, label_en, label_bn, url, sort_order)
join public.menu_items m on m.label_en = i.menu and m.parent_id is null;

insert into public.site_links (placement, label_en, label_bn, url, icon, sort_order) values
  ('quick', 'Education board results', 'শিক্ষা বোর্ডের ফলাফল', 'https://www.educationboardresults.gov.bd/', 'graduation-cap', 1),
  ('quick', 'Ministry of Education', 'শিক্ষা মন্ত্রণালয়', 'https://moedu.gov.bd/', 'landmark', 2),
  ('quick', 'Directorate of Secondary and Higher Education', 'মাধ্যমিক ও উচ্চ শিক্ষা অধিদপ্তর', 'https://dshe.gov.bd/', 'building', 3),
  ('quick', 'Teacher and staff login', 'শিক্ষক ও কর্মচারী লগইন', '/login', 'log-in', 4),
  ('footer', 'Ministry of Education', 'শিক্ষা মন্ত্রণালয়', 'https://moedu.gov.bd/', 'link', 1),
  ('footer', 'Directorate of Secondary and Higher Education', 'মাধ্যমিক ও উচ্চ শিক্ষা অধিদপ্তর', 'https://dshe.gov.bd/', 'link', 2),
  ('footer', 'Education board results', 'শিক্ষা বোর্ডের ফলাফল', 'https://www.educationboardresults.gov.bd/', 'link', 3);

commit;
