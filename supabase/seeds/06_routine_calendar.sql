-- Demo data (part 6): Step 3.5 exam schedule and holidays.

-- Annual Exam 2026, Class 6: one subject a day from 20 November, 10:00 to 13:00.
insert into public.exam_schedule (exam_id, class_id, subject_id, exam_date, starts_at, ends_at)
select e.id, c.id, s.id, date '2026-11-20' + (row_number() over (order by s.sort_order))::int - 1,
  '10:00', '13:00'
from public.exams e
join public.classes c on c.level = 6
join public.subjects s on s.code in ('BAN', 'ENG', 'MATH', 'SCI', 'ICT', 'REL')
where e.name_en = 'Annual Exam 2026';

insert into public.holidays (title_en, title_bn, starts_on, ends_on) values
  ('Eid-e-Milad-un-Nabi', 'ঈদে মিলাদুন্নবী', '2026-08-26', '2026-08-26'),
  ('Victory Day', 'বিজয় দিবস', '2026-12-16', '2026-12-16'),
  ('Winter vacation', 'শীতকালীন ছুটি', '2026-12-20', '2026-12-31'),
  ('International Mother Language Day', 'আন্তর্জাতিক মাতৃভাষা দিবস', '2026-02-21', '2026-02-21'),
  ('Independence Day', 'স্বাধীনতা দিবস', '2026-03-26', '2026-03-26');

-- Menu: the exam routine under Academic, and "Academic calendar" now opens the calendar
-- page instead of the text page.
insert into public.menu_items (parent_id, label_en, label_bn, url, sort_order)
select m.id, 'Exam routine', 'পরীক্ষার রুটিন', '/exam-routine', 22
from public.menu_items m where m.label_en = 'Academic' and m.parent_id is null;
update public.menu_items set url = '/calendar', page_id = null
where page_id = (select id from public.pages where slug = 'academic-calendar');
