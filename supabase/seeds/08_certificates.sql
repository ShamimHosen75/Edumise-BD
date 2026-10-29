-- Demo certificates: a valid testimonial for Tanvir Hasan and a revoked character
-- certificate for Sakib Al Mamun. Verify them at /en/verify/TS-7KQ2-M9XA-4P.
insert into public.certificates (reference, type, student_id, student_name_en, student_name_bn,
  body_en, body_bn, issued_on, issued_by, revoked_at, revoked_by, revoke_reason)
select x.reference, x.type, st.id, st.full_name_en, st.full_name_bn, x.body_en, x.body_bn,
  x.issued_on::date, '00000000-0000-4000-a000-000000000002',
  x.revoked_at::timestamptz,
  case when x.revoked_at is not null then '00000000-0000-4000-a000-000000000002'::uuid end,
  x.reason
from (values
  ('TS-7KQ2-M9XA-4P', 'testimonial', 'Tanvir Hasan', '2026-10-20', null, null,
   'This is to certify that Tanvir Hasan is a student of Class 6, section A, roll 3, in the 2026 session. To the best of my knowledge, he bears a good moral character. I wish him every success in life.',
   'এই মর্মে প্রত্যয়ন করা যাচ্ছে যে তানভীর হাসান ২০২৬ শিক্ষাবর্ষে ষষ্ঠ শ্রেণির ক শাখার শিক্ষার্থী, রোল ৩। আমার জানামতে তার নৈতিক চরিত্র ভালো। আমি তার জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।'),
  ('CC-H3RD-8WJY-6T', 'character', 'Sakib Al Mamun', '2026-10-01', '2026-10-05 11:00+06', 'Issued with a spelling mistake; replaced.',
   'This is to certify that Sakib Al Mamun is a student of Class 6, section A, roll 5, in the 2026 session. As far as I know, his character is good.',
   'এই মর্মে প্রত্যয়ন করা যাচ্ছে যে সাকিব আল মামুন ২০২৬ শিক্ষাবর্ষে ষষ্ঠ শ্রেণির ক শাখার শিক্ষার্থী, রোল ৫। আমার জানামতে তার চরিত্র ভালো।')
) as x(reference, type, name, issued_on, revoked_at, reason, body_en, body_bn)
join public.students st on st.full_name_en = x.name;
