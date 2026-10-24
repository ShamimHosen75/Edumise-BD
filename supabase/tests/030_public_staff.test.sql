-- Step 1.2: the public staff view exposes only public fields (privacy rule).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select columns_are('public', 'public_staff', array[
  'id', 'full_name_en', 'full_name_bn', 'photo_path', 'designation_en', 'designation_bn',
  'designation_rank', 'subject_en', 'subject_bn', 'qualification_en', 'qualification_bn',
  'bio_en', 'bio_bn', 'joining_year', 'is_current', 'sort_order'
], 'public_staff has only public columns');

select hasnt_column('public', 'public_staff', 'nid', 'no NID');
select hasnt_column('public', 'public_staff', 'birth_date', 'no birth date');
select hasnt_column('public', 'public_staff', 'address', 'no address');
select hasnt_column('public', 'public_staff', 'personal_phone', 'no personal phone');
select is((select count(*)::int from public.public_staff where not is_current), 1, 'former staff are listed as not current');

select * from finish();
rollback;
