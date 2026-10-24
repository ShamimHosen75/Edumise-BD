-- Demo data (part 5): notices, news, events, gallery and downloads for Step 2.3.

-- Older public notices, so the notice list has a second page.
insert into public.notices (slug, title_en, title_bn, body_en, body_bn, category, is_published, published_at)
select format('demo-notice-%s', n),
  format('School notice number %s', n), format('স্কুলের নোটিশ নম্বর %s', n),
  '<p>Please read this notice carefully.</p>', '<p>অনুগ্রহ করে নোটিশটি মনোযোগ দিয়ে পড়ুন।</p>',
  (array['general', 'exam', 'admission', 'holiday', 'result'])[1 + n % 5]::public.notice_category,
  true, timestamptz '2026-09-01 09:00+06' + make_interval(days => n)
from generate_series(1, 8) as n;

-- A notice with a PDF attachment (inline preview + download).
update public.notices set
  attachment_path = 'demo/notice-sample.pdf',
  body_en = '<p>The routine for the Annual Exam 2026 is attached. Exams start on 20 November.</p>',
  body_bn = '<p>বার্ষিক পরীক্ষা ২০২৬-এর রুটিন সংযুক্ত করা হলো। পরীক্ষা শুরু ২০ নভেম্বর।</p>'
where slug = 'annual-exam-routine-2026';

-- News with cover photos.
update public.news set cover_path = 'demo/gallery-2.jpg',
  body_en = '<p>Three of our students won first prize at the district science fair with a water filter made from local materials.</p>',
  body_bn = '<p>স্থানীয় উপকরণে তৈরি পানি পরিশোধন যন্ত্র দিয়ে আমাদের তিন শিক্ষার্থী জেলা বিজ্ঞান মেলায় প্রথম পুরস্কার জিতেছে।</p>'
where slug = 'science-fair-winners';
insert into public.news (slug, title_en, title_bn, body_en, body_bn, cover_path, is_published, published_at) values
  ('new-library-wing', 'A new wing for the library', 'গ্রন্থাগারের নতুন অংশ',
   '<p>The library now has a quiet reading room with 40 seats.</p>', '<p>গ্রন্থাগারে এখন ৪০ আসনের একটি নীরব পাঠকক্ষ রয়েছে।</p>',
   'demo/slider-3.jpg', true, '2026-08-20 10:00+06'),
  ('football-champions', 'Our football team are district champions', 'আমাদের ফুটবল দল জেলা চ্যাম্পিয়ন',
   '<p>The team won the final 2–1.</p>', '<p>দলটি ফাইনালে ২–১ গোলে জিতেছে।</p>',
   'demo/gallery-3.jpg', true, '2026-07-15 10:00+06');

-- A second gallery album, and events linked to albums.
insert into public.gallery_albums (slug, title_en, title_bn, cover_path, event_date, is_published, published_at) values
  ('annual-sports-2025', 'Annual Sports Day 2025', 'বার্ষিক ক্রীড়া দিবস ২০২৫', 'demo/slider-2.jpg', '2025-11-06',
   true, '2025-11-07 09:00+06');
insert into public.gallery_images (album_id, image_path, caption_en, caption_bn, sort_order)
select a.id, i.path, i.caption_en, i.caption_bn, i.sort_order
from public.gallery_albums a
cross join (values ('demo/slider-2.jpg', 'Opening march', 'উদ্বোধনী কুচকাওয়াজ', 1),
                   ('demo/gallery-3.jpg', '100 m race', '১০০ মিটার দৌড়', 2),
                   ('demo/gallery-1.jpg', 'Prize giving', 'পুরস্কার বিতরণ', 3)) as i(path, caption_en, caption_bn, sort_order)
where a.slug = 'annual-sports-2025';

update public.events set album_id = (select id from public.gallery_albums where slug = 'independence-day-2026'),
  body_en = '<p>Flag hoisting, songs and a cultural programme.</p>', body_bn = '<p>পতাকা উত্তোলন, সংগীত ও সাংস্কৃতিক অনুষ্ঠান।</p>'
where slug = 'independence-day-2026';
update public.events set cover_path = 'demo/slider-2.jpg',
  body_en = '<p>Races, games and prize giving for all classes.</p>', body_bn = '<p>সব শ্রেণির জন্য দৌড়, খেলা ও পুরস্কার বিতরণ।</p>'
where slug = 'annual-sports-2026';

-- Downloads with real (demo) files.
update public.downloads set file_path = 'demo/calendar-2026.pdf', file_size = 1024 where file_path = 'demo/calendar-2026.pdf';
insert into public.downloads (title_en, title_bn, category, file_path, file_size, mime_type, is_published, published_at) values
  ('Admission form 2027', 'ভর্তি ফরম ২০২৭', 'forms', 'demo/notice-sample.pdf', 1024, 'application/pdf', true, '2026-10-01 09:00+06'),
  ('Class 9 syllabus', 'নবম শ্রেণির সিলেবাস', 'syllabus', 'demo/notice-sample.pdf', 1024, 'application/pdf', true, '2026-01-10 09:00+06'),
  ('Draft circular', 'খসড়া পরিপত্র', 'general', 'demo/notice-sample.pdf', 1024, 'application/pdf', false, null);
