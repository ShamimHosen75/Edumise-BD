-- Demo data (part 3 of 3). See supabase/seed.sql for the demo logins.

-- ---------------------------------------------------------------- exams
insert into public.exams (session_id, name_en, name_bn, starts_on, ends_on, status, schedule_published, published_at)
select se.id, x.name_en, x.name_bn, x.starts_on::date, x.ends_on::date, x.status::public.exam_status,
  true, x.published_at::timestamptz
from public.academic_sessions se
cross join (values
  ('Half Yearly Exam 2026', 'অর্ধবার্ষিক পরীক্ষা ২০২৬', '2026-06-01', '2026-06-12', 'published', '2026-07-01 10:00+06'),
  ('Annual Exam 2026', 'বার্ষিক পরীক্ষা ২০২৬', '2026-11-20', '2026-12-05', 'draft', null)
) as x(name_en, name_bn, starts_on, ends_on, status, published_at)
where se.is_current;

insert into public.exam_classes (exam_id, class_id)
select e.id, c.id from public.exams e, public.classes c where c.level in (6, 9);

-- Class 6 subjects for both exams: CQ 70 / MCQ 30 (ICT: CQ 25 / MCQ 15 / practical 10).
insert into public.exam_subjects (exam_id, class_id, subject_id, cq_full, cq_pass, mcq_full, mcq_pass,
  practical_full, practical_pass, locked)
select e.id, c.id, s.id,
  case when s.code = 'ICT' then 25 else 70 end, case when s.code = 'ICT' then 8 else 23 end,
  case when s.code = 'ICT' then 15 else 30 end, case when s.code = 'ICT' then 5 else 10 end,
  case when s.code = 'ICT' then 10 else 0 end, case when s.code = 'ICT' then 3 end,
  e.status = 'published'
from public.exams e
join public.classes c on c.level = 6
join public.class_subjects cs on cs.class_id = c.id
join public.subjects s on s.id = cs.subject_id;

-- Marks for 6A in the published exam. Mim (roll 6) fails Mathematics.
insert into public.marks (exam_subject_id, student_id, cq, mcq, practical, entered_by)
select es.id, en.student_id,
  case when en.roll = 6 and s.code = 'MATH' then 15
       else least(es.cq_full, round(es.cq_full * (0.55 + ((en.roll * 7 + s.sort_order * 3) % 40) / 100.0)))
  end,
  case when en.roll = 6 and s.code = 'MATH' then 8
       else least(es.mcq_full, round(es.mcq_full * (0.60 + ((en.roll * 5 + s.sort_order) % 35) / 100.0)))
  end,
  case when es.practical_full > 0 then es.practical_full - (en.roll % 3) end,
  '00000000-0000-4000-a000-000000000003'
from public.exams e
join public.exam_subjects es on es.exam_id = e.id
join public.subjects s on s.id = es.subject_id
join public.enrollments en on true
join public.sections sec on sec.id = en.section_id and sec.class_id = es.class_id and sec.name_en = 'A'
where e.status = 'published';

-- ---------------------------------------------------------------- website
insert into public.notices (slug, title_en, title_bn, body_en, body_bn, category, audience, target_class_id,
  is_pinned, is_published, published_at, created_by)
values
  ('annual-exam-routine-2026', 'Annual Exam 2026 routine published', 'বার্ষিক পরীক্ষা ২০২৬-এর রুটিন প্রকাশিত',
   'The Annual Exam starts on 20 November.', 'বার্ষিক পরীক্ষা ২০ নভেম্বর শুরু হবে।', 'exam', 'public', null,
   true, true, '2026-10-20 09:00+06', '00000000-0000-4000-a000-000000000002'),
  ('half-yearly-result-2026', 'Half Yearly Exam 2026 results', 'অর্ধবার্ষিক পরীক্ষা ২০২৬-এর ফলাফল',
   'Results are now available.', 'ফলাফল এখন পাওয়া যাচ্ছে।', 'result', 'public', null,
   false, true, '2026-07-01 10:00+06', '00000000-0000-4000-a000-000000000002'),
  ('victory-day-holiday', 'Holiday for Victory Day', 'বিজয় দিবসের ছুটি',
   'The school will be closed on 16 December.', '১৬ ডিসেম্বর স্কুল বন্ধ থাকবে।', 'holiday', 'public', null,
   false, true, '2026-10-15 09:00+06', '00000000-0000-4000-a000-000000000002'),
  ('teachers-meeting-october', 'Teachers'' meeting on Thursday', 'বৃহস্পতিবার শিক্ষকদের সভা',
   'All teachers meet in the library at 2 pm.', 'সকল শিক্ষক দুপুর ২টায় লাইব্রেরিতে মিলিত হবেন।', 'general', 'staff', null,
   false, true, '2026-10-19 09:00+06', '00000000-0000-4000-a000-000000000002'),
  ('class-6-parents-day', 'Class 6 parents'' day', 'ষষ্ঠ শ্রেণির অভিভাবক দিবস',
   'Parents of Class 6 are invited on Saturday.', 'ষষ্ঠ শ্রেণির অভিভাবকদের শনিবার আমন্ত্রণ।', 'general', 'class',
   (select id from public.classes where level = 6),
   false, true, '2026-10-21 09:00+06', '00000000-0000-4000-a000-000000000002'),
  ('admission-2027-draft', 'Admission 2027 (draft)', 'ভর্তি ২০২৭ (খসড়া)',
   'Draft, not yet published.', 'খসড়া, এখনো প্রকাশিত নয়।', 'admission', 'public', null,
   false, false, null, '00000000-0000-4000-a000-000000000003');

insert into public.news (slug, title_en, title_bn, body_en, body_bn, is_published, published_at) values
  ('science-fair-winners', 'Our students win the district science fair', 'জেলা বিজ্ঞান মেলায় আমাদের শিক্ষার্থীদের জয়',
   'Three students won first prize.', 'তিনজন শিক্ষার্থী প্রথম পুরস্কার পেয়েছে।', true, '2026-09-10 12:00+06'),
  ('new-ict-lab-draft', 'New ICT lab (draft)', 'নতুন আইসিটি ল্যাব (খসড়া)', '', '', false, null);

insert into public.events (slug, title_en, title_bn, venue_en, venue_bn, starts_at, ends_at, is_published, published_at) values
  ('annual-sports-2026', 'Annual Sports Day 2026', 'বার্ষিক ক্রীড়া দিবস ২০২৬', 'School field', 'স্কুল মাঠ',
   '2026-11-05 09:00+06', '2026-11-05 16:00+06', true, '2026-10-01 09:00+06'),
  ('independence-day-2026', 'Independence Day programme', 'স্বাধীনতা দিবস অনুষ্ঠান', 'Auditorium', 'মিলনায়তন',
   '2026-03-26 09:00+06', '2026-03-26 12:00+06', true, '2026-03-01 09:00+06');

insert into public.pages (slug, title_en, title_bn, body_en, body_bn, is_published, published_at) values
  ('about-us', 'About us', 'আমাদের সম্পর্কে',
   '<p>Sunrise High School was founded in 1975.</p>', '<p>সানরাইজ হাই স্কুল ১৯৭৫ সালে প্রতিষ্ঠিত।</p>',
   true, '2026-01-01 09:00+06'),
  ('history', 'History', 'ইতিহাস', '', '', false, null);

insert into public.sliders (image_path, title_en, title_bn, sort_order, is_published, published_at) values
  ('demo/slider-1.jpg', 'Learning for life', 'জীবনের জন্য শিক্ষা', 1, true, '2026-01-01 09:00+06'),
  ('demo/slider-2.jpg', 'Annual Sports Day', 'বার্ষিক ক্রীড়া দিবস', 2, true, '2026-01-01 09:00+06');

insert into public.gallery_albums (slug, title_en, title_bn, cover_path, event_date, is_published, published_at) values
  ('independence-day-2026', 'Independence Day 2026', 'স্বাধীনতা দিবস ২০২৬', 'demo/gallery-1.jpg', '2026-03-26',
   true, '2026-03-27 09:00+06');
insert into public.gallery_images (album_id, image_path, caption_en, caption_bn, sort_order)
select a.id, i.path, i.caption_en, i.caption_bn, i.sort_order
from public.gallery_albums a
cross join (values ('demo/gallery-1.jpg', 'Flag hoisting', 'পতাকা উত্তোলন', 1),
                   ('demo/gallery-2.jpg', 'Cultural programme', 'সাংস্কৃতিক অনুষ্ঠান', 2))
  as i(path, caption_en, caption_bn, sort_order);

insert into public.downloads (title_en, title_bn, category, file_path, file_size, mime_type, is_published, published_at) values
  ('Academic calendar 2026', 'একাডেমিক ক্যালেন্ডার ২০২৬', 'calendar', 'demo/calendar-2026.pdf', 102400,
   'application/pdf', true, '2026-01-01 09:00+06');

-- ---------------------------------------------------------------- fees
insert into public.fee_heads (code, name_en, name_bn, frequency, sort_order) values
  ('ADMISSION', 'Admission fee', 'ভর্তি ফি', 'one_time', 1),
  ('SESSION', 'Session fee', 'সেশন ফি', 'one_time', 2),
  ('TUITION', 'Monthly tuition', 'মাসিক বেতন', 'monthly', 3),
  ('EXAM', 'Exam fee', 'পরীক্ষা ফি', 'one_time', 4);

-- Amounts in poisha: Tk 600 tuition = 60000.
insert into public.fee_structures (session_id, class_id, group_id, fee_head_id, amount)
select se.id, c.id, null, h.id,
  case h.code when 'ADMISSION' then 200000 when 'SESSION' then 150000 when 'TUITION' then
    case when c.level >= 9 then 80000 else 60000 end else 50000 end
from public.academic_sessions se, public.classes c, public.fee_heads h
where se.is_current;

-- Sibling discount: Rahim pays half tuition.
insert into public.fee_waivers (student_id, session_id, fee_head_id, kind, value, reason, approved_by, approved_at)
select st.id, se.id, h.id, 'percent', 50, 'Sibling discount', '00000000-0000-4000-a000-000000000002', now()
from public.students st, public.academic_sessions se, public.fee_heads h
where st.full_name_en = 'Rahim Ahmed' and se.is_current and h.code = 'TUITION';

-- October 2026 tuition invoices for 6A rolls 1-3: paid, partial, unpaid.
insert into public.invoices (invoice_no, student_id, session_id, issued_on, due_on, status, total, paid, created_by)
select format('INV-2026-%s', lpad(en.roll::text, 5, '0')), en.student_id, en.session_id,
  '2026-10-01', '2026-10-15',
  (case en.roll when 1 then 'paid' when 2 then 'partial' else 'unpaid' end)::public.invoice_status,
  case en.roll when 1 then 30000 else 60000 end,
  case en.roll when 1 then 30000 when 2 then 20000 else 0 end,
  '00000000-0000-4000-a000-000000000004'
from public.enrollments en
join public.sections sec on sec.id = en.section_id and sec.name_en = 'A'
join public.classes c on c.id = sec.class_id and c.level = 6
where en.roll <= 3;

insert into public.invoice_items (invoice_id, student_id, fee_head_id, period_key, gross, waiver)
select i.id, i.student_id, h.id, '2026-10', 60000, case when i.total = 30000 then 30000 else 0 end
from public.invoices i
cross join public.fee_heads h
where h.code = 'TUITION';
