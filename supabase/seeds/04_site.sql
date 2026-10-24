-- Demo data (part 4): website shell. Pages and menu follow the reference school site.
-- Photos under demo/ are bundled with the app (public/demo); real uploads use Storage.

update public.school_settings set
  facebook_url = 'https://www.facebook.com/',
  youtube_url = 'https://www.youtube.com/',
  head_photo_path = 'demo/head-teacher.jpg',
  office_hours_en = 'Saturday–Thursday, 8:00 am – 3:00 pm';

-- The static pages of the reference school site (Step 2.2), with short starter text the
-- school office replaces. 'history' stays unpublished and 'donors' empty, to show that
-- such menu items are hidden automatically.
create temporary table seed_pages (menu text, sort_order int, slug text, title_en text, title_bn text);
insert into seed_pages values
  ('About', 1, 'about-us', 'About us', 'আমাদের সম্পর্কে'),
  ('About', 2, 'history', 'History', 'ইতিহাস'),
  ('About', 3, 'mission-vision', 'Mission and vision', 'লক্ষ্য ও উদ্দেশ্য'),
  ('About', 4, 'chairman-message', 'Chairman''s message', 'সভাপতির বাণী'),
  ('About', 5, 'principal-message', 'Head teacher''s message', 'প্রধান শিক্ষকের বাণী'),
  ('About', 6, 'administrators', 'Administrators', 'প্রশাসনিক কর্মকর্তা'),
  ('About', 7, 'donors', 'Donors', 'দাতা সদস্য'),
  ('About', 8, 'achievements', 'Achievements', 'অর্জন'),
  ('About', 9, 'campus-tour', 'Campus tour', 'ক্যাম্পাস পরিচিতি'),
  ('Information', 1, 'recognition-letter', 'Recognition letter', 'স্বীকৃতিপত্র'),
  ('Information', 2, 'nationalization', 'Nationalisation', 'জাতীয়করণ'),
  ('Information', 3, 'govt-approval', 'Government approval', 'সরকারি অনুমোদন'),
  ('Information', 4, 'statistics', 'Statistics', 'পরিসংখ্যান'),
  ('Information', 5, 'rules', 'Rules and regulations', 'নিয়মকানুন'),
  ('Information', 6, 'uniform', 'School uniform', 'স্কুল ইউনিফর্ম'),
  ('Information', 7, 'daily-activities', 'Daily activities', 'দৈনন্দিন কার্যক্রম'),
  ('Academic', 1, 'academic-rules', 'Academic rules', 'একাডেমিক নিয়মাবলি'),
  ('Academic', 2, 'academic-calendar', 'Academic calendar', 'একাডেমিক ক্যালেন্ডার'),
  ('Academic', 3, 'exam-system', 'Examination system', 'পরীক্ষা পদ্ধতি'),
  ('Academic', 4, 'co-curricular', 'Co-curricular activities', 'সহশিক্ষা কার্যক্রম'),
  ('Academic', 5, 'why-study', 'Why study here', 'কেন এখানে পড়বেন'),
  ('Admission', 1, 'how-to-apply', 'How to apply', 'কীভাবে আবেদন করবেন'),
  ('Admission', 2, 'admission-test', 'Admission test', 'ভর্তি পরীক্ষা'),
  ('Admission', 3, 'admission-policy', 'Admission policy', 'ভর্তি নীতিমালা'),
  ('Admission', 4, 'registration-system', 'Registration system', 'রেজিস্ট্রেশন পদ্ধতি'),
  ('Admission', 5, 'tuition-fees', 'Tuition fees', 'বেতন ও ফি'),
  ('Admission', 6, 'mobile-banking', 'Paying by mobile banking', 'মোবাইল ব্যাংকিংয়ে ফি প্রদান'),
  ('Facilities', 1, 'library', 'Library', 'গ্রন্থাগার'),
  ('Facilities', 2, 'playground', 'Playground', 'খেলার মাঠ'),
  ('Facilities', 3, 'physics-lab', 'Physics lab', 'পদার্থবিজ্ঞান ল্যাব'),
  ('Facilities', 4, 'chemistry-lab', 'Chemistry lab', 'রসায়ন ল্যাব'),
  ('Facilities', 5, 'biology-lab', 'Biology lab', 'জীববিজ্ঞান ল্যাব'),
  ('Facilities', 6, 'ict-lab', 'ICT lab', 'আইসিটি ল্যাব');

-- about-us and history already exist (seed part 3); they are kept as they are.
insert into public.pages (slug, title_en, title_bn, body_en, body_bn, is_published, published_at)
select slug, title_en, title_bn,
  case when slug = 'donors' then ''
       else format('<h2>%s</h2><p>This page describes %s at Sunrise High School. The school office keeps it up to date.</p>', title_en, lower(title_en)) end,
  case when slug = 'donors' then ''
       else format('<h2>%s</h2><p>সানরাইজ হাই স্কুলের %s সম্পর্কে তথ্য। স্কুল অফিস এই পাতা হালনাগাদ রাখে।</p>', title_bn, title_bn) end,
  true, '2026-01-01 09:00+06'
from seed_pages
on conflict (slug) do nothing;

-- A head teacher's message page with real text, linked from the home page.
update public.pages set
  body_en = '<p>Welcome to Sunrise High School. For fifty years we have helped every student learn, grow and lead.</p><p>Our teachers know each student by name, and we work closely with parents.</p>',
  body_bn = '<p>সানরাইজ হাই স্কুলে স্বাগতম। পঞ্চাশ বছর ধরে আমরা প্রতিটি শিক্ষার্থীকে শিখতে, বেড়ে উঠতে ও নেতৃত্ব দিতে সাহায্য করছি।</p><p>আমাদের শিক্ষকেরা প্রত্যেক শিক্ষার্থীকে নামে চেনেন এবং অভিভাবকদের সঙ্গে মিলে কাজ করেন।</p>'
where slug = 'principal-message';

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
select m.id, sp.title_en, sp.title_bn, p.id, sp.sort_order
from seed_pages sp
join public.menu_items m on m.label_en = sp.menu and m.parent_id is null
join public.pages p on p.slug = sp.slug;

drop table seed_pages;

-- Items whose pages arrive in later steps (hidden until their route exists).
insert into public.menu_items (parent_id, label_en, label_bn, url, sort_order)
select m.id, i.label_en, i.label_bn, i.url, i.sort_order
from (values
  ('Information', 'Notices', 'নোটিশ', '/notices', 22),
  ('Information', 'Teachers and staff', 'শিক্ষক ও কর্মচারী', '/teachers', 23),
  ('Academic', 'Class routine', 'ক্লাস রুটিন', '/routine', 21),
  ('Admission', 'Apply online', 'অনলাইনে আবেদন', '/admission/apply', 21),
  ('Result', 'Find a result', 'ফলাফল খুঁজুন', '/result', 21),
  ('Others', 'Gallery', 'গ্যালারি', '/gallery', 21),
  ('Others', 'Downloads', 'ডাউনলোড', '/downloads', 22)
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
