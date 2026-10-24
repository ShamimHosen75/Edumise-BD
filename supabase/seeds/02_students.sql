-- Demo data (part 2 of 3). See supabase/seed.sql for the demo logins.

-- ---------------------------------------------------------------- students
-- 20 students: 6A (6), 6B (4), 9A science (6), 9B business/humanities (4).
create temporary table seed_students (
  n int, name_en text, name_bn text, gender public.gender, level int, section text, grp text, roll int
);
insert into seed_students values
  (1,  'Rahim Ahmed',     'রহিম আহমেদ',     'male',   6, 'A', null, 1),
  (2,  'Ayesha Siddika',  'আয়েশা সিদ্দিকা',  'female', 6, 'A', null, 2),
  (3,  'Tanvir Hasan',    'তানভীর হাসান',    'male',   6, 'A', null, 3),
  (4,  'Nusrat Jahan',    'নুসরাত জাহান',    'female', 6, 'A', null, 4),
  (5,  'Sakib Al Mamun',  'সাকিব আল মামুন',  'male',   6, 'A', null, 5),
  (6,  'Mim Akter',       'মিম আক্তার',      'female', 6, 'A', null, 6),
  (7,  'Arif Hossain',    'আরিফ হোসেন',     'male',   6, 'B', null, 1),
  (8,  'Sumaiya Islam',   'সুমাইয়া ইসলাম',   'female', 6, 'B', null, 2),
  (9,  'Fahim Chowdhury', 'ফাহিম চৌধুরী',    'male',   6, 'B', null, 3),
  (10, 'Lamia Rahman',    'লামিয়া রহমান',    'female', 6, 'B', null, 4),
  (11, 'Karim Ahmed',     'করিম আহমেদ',     'male',   9, 'A', 'science', 1),
  (12, 'Tasnim Ferdous',  'তাসনিম ফেরদৌস',   'female', 9, 'A', 'science', 2),
  (13, 'Rakib Hasan',     'রাকিব হাসান',     'male',   9, 'A', 'science', 3),
  (14, 'Jannatul Ferdous','জান্নাতুল ফেরদৌস', 'female', 9, 'A', 'science', 4),
  (15, 'Imran Kabir',     'ইমরান কবির',      'male',   9, 'A', 'science', 5),
  (16, 'Sadia Afrin',     'সাদিয়া আফরিন',    'female', 9, 'A', 'science', 6),
  (17, 'Nayeem Islam',    'নাঈম ইসলাম',      'male',   9, 'B', 'business', 1),
  (18, 'Rumana Akter',    'রুমানা আক্তার',    'female', 9, 'B', 'business', 2),
  (19, 'Shuvo Das',       'শুভ দাস',         'male',   9, 'B', 'humanities', 3),
  (20, 'Priya Saha',      'প্রিয়া সাহা',      'female', 9, 'B', 'humanities', 4);

insert into public.students (
  profile_id, student_code, full_name_en, full_name_bn, gender, religion, blood_group,
  status, admitted_on, birth_date, birth_reg_no, address, personal_phone
)
select
  case when s.n = 1 then '00000000-0000-4000-a000-000000000005'::uuid end,
  format('2026%s%s', lpad(s.level::text, 2, '0'), lpad(s.n::text, 4, '0')),
  s.name_en, s.name_bn, s.gender,
  (case when s.n in (19, 20) then 'hinduism' else 'islam' end)::public.religion,
  (array['A+', 'B+', 'O+', 'AB+'])[1 + s.n % 4]::public.blood_group,
  'active', '2026-01-01',
  make_date(2026 - s.level - 6, 1 + s.n % 12, 1 + s.n % 28),
  '20132691' || lpad(s.n::text, 9, '0'),
  format('Village %s, Demo Upazila', s.n), null
from seed_students s;

insert into public.enrollments (student_id, session_id, section_id, group_id, roll, fourth_subject_id)
select st.id, se.id, sec.id, g.id, s.roll,
  case s.grp when 'science' then (select id from public.subjects where code = 'HMATH')
             when 'business' then (select id from public.subjects where code = 'AGRI')
             when 'humanities' then (select id from public.subjects where code = 'AGRI') end
from seed_students s
join public.students st on st.full_name_en = s.name_en
join public.academic_sessions se on se.is_current
join public.classes c on c.level = s.level
join public.sections sec on sec.class_id = c.id and sec.name_en = s.section
left join public.groups g on g.code = s.grp;

-- Guardians: Jamal Ahmed (login) has two children, Rahim (6A) and Karim (9A).
insert into public.guardians (profile_id, full_name_en, full_name_bn, phone, email, occupation, nid, address)
values ('00000000-0000-4000-a000-000000000006', 'Jamal Ahmed', 'জামাল আহমেদ', '01810000006',
  'guardian@sunrise.test', 'Business', '2990000000001', 'Village 1, Demo Upazila');

insert into public.guardians (full_name_en, full_name_bn, phone, occupation, nid, address)
select 'Guardian of ' || s.name_en, 'অভিভাবক: ' || s.name_bn, '0181' || lpad((100000 + s.n)::text, 7, '0'),
  'Farmer', '29900000' || lpad((s.n + 100)::text, 5, '0'), format('Village %s, Demo Upazila', s.n)
from seed_students s where s.n not in (1, 11);

insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
select st.id, g.id, 'father', true
from public.students st
join public.guardians g on g.full_name_en = 'Jamal Ahmed'
where st.full_name_en in ('Rahim Ahmed', 'Karim Ahmed');

insert into public.student_guardians (student_id, guardian_id, relation, is_primary)
select st.id, g.id, 'father', true
from public.students st
join public.guardians g on g.full_name_en = 'Guardian of ' || st.full_name_en;

-- ---------------------------------------------------------------- teaching
-- Kamal (teacher login) teaches Mathematics in 6A, 6B and 9A.
insert into public.teacher_assignments (session_id, staff_id, section_id, subject_id)
select se.id, sf.id, sec.id, sub.id
from public.academic_sessions se
cross join (values ('Kamal Hossain', 6, 'A', 'MATH'), ('Kamal Hossain', 6, 'B', 'MATH'),
                   ('Kamal Hossain', 9, 'A', 'MATH'), ('Shirin Sultana', 6, 'A', 'SCI'),
                   ('Shirin Sultana', 9, 'A', 'PHY'), ('Habibur Rahman', 6, 'A', 'ICT'),
                   ('Nasrin Akter', 6, 'A', 'ENG'), ('Abdul Karim', 6, 'A', 'BAN'))
  as a(teacher, level, section, subject)
join public.staff sf on sf.full_name_en = a.teacher
join public.classes c on c.level = a.level
join public.sections sec on sec.class_id = c.id and sec.name_en = a.section
join public.subjects sub on sub.code = a.subject
where se.is_current;

insert into public.periods (number, starts_at, ends_at, is_break) values
  (1, '08:00', '08:45', false), (2, '08:45', '09:30', false), (3, '09:30', '10:15', false),
  (4, '10:15', '11:00', false), (5, '11:00', '11:30', true),  (6, '11:30', '12:15', false),
  (7, '12:15', '13:00', false);

insert into public.rooms (name) values ('Room 101'), ('Room 102'), ('Room 201'), ('Physics Lab'), ('ICT Lab');

-- 6A Saturday and Sunday mornings.
insert into public.routine (session_id, section_id, day_of_week, period_id, subject_id, staff_id, room_id)
select se.id, sec.id, r.dow, p.id, sub.id, sf.id, rm.id
from (values (6, 1, 'BAN', 'Abdul Karim'), (6, 2, 'ENG', 'Nasrin Akter'), (6, 3, 'MATH', 'Kamal Hossain'),
             (6, 4, 'SCI', 'Shirin Sultana'), (0, 1, 'MATH', 'Kamal Hossain'), (0, 2, 'ICT', 'Habibur Rahman'))
  as r(dow, period, subject, teacher)
join public.academic_sessions se on se.is_current
join public.classes c on c.level = 6
join public.sections sec on sec.class_id = c.id and sec.name_en = 'A'
join public.periods p on p.number = r.period
join public.subjects sub on sub.code = r.subject
join public.staff sf on sf.full_name_en = r.teacher
join public.rooms rm on rm.name = case when r.subject = 'ICT' then 'ICT Lab' else 'Room 101' end;

-- ---------------------------------------------------------------- attendance
-- 6A, Sunday 18 to Thursday 22 October 2026.
insert into public.attendance (student_id, section_id, date, status, marked_by)
select e.student_id, e.section_id, d::date,
  (case
     when e.roll = 6 and extract(dow from d) in (1, 2) then 'absent'
     when e.roll = 3 and extract(dow from d) = 3 then 'late'
     when e.roll = 4 and extract(dow from d) = 4 then 'leave'
     else 'present'
   end)::public.attendance_status,
  '00000000-0000-4000-a000-000000000003'
from public.enrollments e
join public.sections sec on sec.id = e.section_id and sec.name_en = 'A'
join public.classes c on c.id = sec.class_id and c.level = 6
cross join generate_series('2026-10-18'::date, '2026-10-22'::date, interval '1 day') as d;

drop table seed_students;
