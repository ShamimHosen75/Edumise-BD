-- Demo data (part 4): website shell. Pages and menu follow the reference school site.
-- Photos under demo/ are bundled with the app (public/demo); real uploads use Storage.

update public.school_settings set
  facebook_url = 'https://www.facebook.com/',
  youtube_url = 'https://www.youtube.com/',
  head_photo_path = 'demo/head-teacher.jpg',
  office_hours_en = 'Saturday–Thursday, 8:00 am – 3:00 pm';

-- More published pages so the menus have something to open (Step 2.2 adds the rest).
insert into public.pages (slug, title_en, title_bn, body_en, body_bn, is_published, published_at) values
  ('mission-vision', 'Mission and vision', 'লক্ষ্য ও উদ্দেশ্য',
   'Our mission is to give every student a strong, caring education.', 'প্রতিটি শিক্ষার্থীকে যত্নশীল ও মানসম্মত শিক্ষা দেওয়াই আমাদের লক্ষ্য।',
   true, '2026-01-01 09:00+06'),
  ('principal-message', 'Message from the head teacher', 'প্রধান শিক্ষকের বাণী',
   'Welcome to our school community.', 'আমাদের স্কুল পরিবারে স্বাগতম।', true, '2026-01-01 09:00+06'),
  ('uniform', 'School uniform', 'স্কুল ইউনিফর্ম',
   'White shirt, navy trousers or skirt, black shoes.', 'সাদা শার্ট, নেভি প্যান্ট বা স্কার্ট, কালো জুতা।', true, '2026-01-01 09:00+06'),
  ('library', 'Library', 'গ্রন্থাগার',
   'Our library has more than 5,000 books.', 'আমাদের গ্রন্থাগারে ৫,০০০-এর বেশি বই আছে।', true, '2026-01-01 09:00+06'),
  ('ict-lab', 'ICT lab', 'আইসিটি ল্যাব',
   'Forty computers with internet for practical classes.', 'ব্যবহারিক ক্লাসের জন্য ইন্টারনেটসহ চল্লিশটি কম্পিউটার।', true, '2026-01-01 09:00+06');

-- Menu (10 top-level menus). Items linked to missing or unpublished pages stay hidden.
insert into public.menu_items (label_en, label_bn, url, sort_order) values
  ('Home', 'হোম', '/', 1),
  ('About', 'আমাদের সম্পর্কে', null, 2),
  ('Information', 'তথ্য', null, 3),
  ('Academic', 'একাডেমিক', null, 4),
  ('Admission', 'ভর্তি', null, 5),
  ('Student', 'শিক্ষার্থী', null, 6),
  ('Facilities', 'সুবিধাসমূহ', null, 7),
  ('Result', 'ফলাফল', null, 8),
  ('Others', 'অন্যান্য', null, 9),
  ('Contact', 'যোগাযোগ', '/contact', 10);

insert into public.menu_items (parent_id, label_en, label_bn, page_id, sort_order)
select m.id, i.label_en, i.label_bn, p.id, i.sort_order
from (values
  ('About', 'About us', 'আমাদের সম্পর্কে', 'about-us', 1),
  ('About', 'History', 'ইতিহাস', 'history', 2),
  ('About', 'Mission and vision', 'লক্ষ্য ও উদ্দেশ্য', 'mission-vision', 3),
  ('About', 'Head teacher''s message', 'প্রধান শিক্ষকের বাণী', 'principal-message', 4),
  ('Information', 'School uniform', 'স্কুল ইউনিফর্ম', 'uniform', 1),
  ('Facilities', 'Library', 'গ্রন্থাগার', 'library', 1),
  ('Facilities', 'ICT lab', 'আইসিটি ল্যাব', 'ict-lab', 2)
) as i(menu, label_en, label_bn, slug, sort_order)
join public.menu_items m on m.label_en = i.menu and m.parent_id is null
join public.pages p on p.slug = i.slug;

-- Items whose pages arrive in later steps (hidden until their route exists).
insert into public.menu_items (parent_id, label_en, label_bn, url, sort_order)
select m.id, i.label_en, i.label_bn, i.url, i.sort_order
from (values
  ('Information', 'Notices', 'নোটিশ', '/notices', 2),
  ('Information', 'Teachers and staff', 'শিক্ষক ও কর্মচারী', '/teachers', 3),
  ('Academic', 'Class routine', 'ক্লাস রুটিন', '/routine', 1),
  ('Admission', 'Apply online', 'অনলাইনে আবেদন', '/admission/apply', 1),
  ('Result', 'Find a result', 'ফলাফল খুঁজুন', '/result', 1),
  ('Others', 'Gallery', 'গ্যালারি', '/gallery', 1),
  ('Others', 'Downloads', 'ডাউনলোড', '/downloads', 2)
) as i(menu, label_en, label_bn, url, sort_order)
join public.menu_items m on m.label_en = i.menu and m.parent_id is null;

insert into public.site_links (placement, label_en, label_bn, url, icon, sort_order) values
  ('quick', 'Education board results', 'শিক্ষা বোর্ডের ফলাফল', 'https://www.educationboardresults.gov.bd/', 'graduation-cap', 1),
  ('quick', 'Ministry of Education', 'শিক্ষা মন্ত্রণালয়', 'https://moedu.gov.bd/', 'landmark', 2),
  ('quick', 'Directorate of Secondary and Higher Education', 'মাধ্যমিক ও উচ্চ শিক্ষা অধিদপ্তর', 'https://dshe.gov.bd/', 'building', 3),
  ('quick', 'Teacher and staff login', 'শিক্ষক ও কর্মচারী লগইন', '/login', 'log-in', 4),
  ('footer', 'Ministry of Education', 'শিক্ষা মন্ত্রণালয়', 'https://moedu.gov.bd/', 'link', 1),
  ('footer', 'Dhaka Education Board', 'ঢাকা শিক্ষা বোর্ড', 'https://dhakaeducationboard.gov.bd/', 'link', 2),
  ('footer', 'Bangladesh National Portal', 'বাংলাদেশ জাতীয় তথ্য বাতায়ন', 'https://bangladesh.gov.bd/', 'link', 3),
  ('footer', 'Draft link (hidden)', 'খসড়া লিংক', 'https://example.com/', 'link', 9);
update public.site_links set is_published = false where label_en = 'Draft link (hidden)';

-- More notices for the ticker and list, and upcoming events.
insert into public.notices (slug, title_en, title_bn, category, audience, is_published, published_at) values
  ('sports-day-registration', 'Sports Day registration is open', 'ক্রীড়া দিবসের নিবন্ধন চলছে', 'general', 'public', true, '2026-10-22 09:00+06'),
  ('class-9-registration', 'Class 9 board registration form', 'নবম শ্রেণির বোর্ড রেজিস্ট্রেশন ফরম', 'exam', 'public', true, '2026-10-21 09:00+06'),
  ('tuition-fee-deadline', 'November tuition fee deadline', 'নভেম্বরের বেতন জমার শেষ তারিখ', 'general', 'public', true, '2026-10-18 09:00+06');

insert into public.events (slug, title_en, title_bn, venue_en, venue_bn, starts_at, ends_at, is_published, published_at) values
  ('science-fair-2026', 'School Science Fair', 'স্কুল বিজ্ঞান মেলা', 'Main hall', 'প্রধান হল',
   '2026-11-15 10:00+06', '2026-11-15 15:00+06', true, '2026-10-10 09:00+06'),
  ('victory-day-2026', 'Victory Day programme', 'বিজয় দিবস অনুষ্ঠান', 'School field', 'স্কুল মাঠ',
   '2026-12-16 09:00+06', '2026-12-16 12:00+06', true, '2026-10-10 09:00+06');

insert into public.sliders (image_path, title_en, title_bn, subtitle_en, subtitle_bn, sort_order, is_published, published_at) values
  ('demo/slider-3.jpg', 'A library for every reader', 'প্রত্যেক পাঠকের জন্য গ্রন্থাগার',
   'More than 5,000 books', '৫,০০০-এর বেশি বই', 3, true, '2026-01-01 09:00+06');
update public.sliders set subtitle_en = 'Since 1975', subtitle_bn = '১৯৭৫ সাল থেকে' where sort_order = 1;

insert into public.gallery_images (album_id, image_path, caption_en, caption_bn, sort_order)
select a.id, i.path, i.caption_en, i.caption_bn, i.sort_order
from public.gallery_albums a
cross join (values ('demo/gallery-3.jpg', 'Prize giving', 'পুরস্কার বিতরণ', 3),
                   ('demo/gallery-4.jpg', 'Book fair', 'বই মেলা', 4)) as i(path, caption_en, caption_bn, sort_order);
