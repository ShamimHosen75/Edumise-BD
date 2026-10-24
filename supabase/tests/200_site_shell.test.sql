-- Step 2.1: menu, links and public statistics.
begin;
create extension if not exists pgtap with schema extensions;
create function pg_temp.affected(sql text) returns int language plpgsql as
  $$ declare n int; begin execute sql; get diagnostics n = row_count; return n; end $$;
select plan(15);

-- Integrity
select throws_ok($$ insert into public.menu_items (parent_id, label_en)
  select id, 'Too deep' from public.menu_items where parent_id is not null limit 1 $$,
  '23514', 'Menus have at most two levels', 'menus have at most two levels');
select throws_ok($$ insert into public.menu_items (label_en, url) values ('Bad', 'javascript:alert(1)') $$,
  '23514', null, 'menu links must be internal paths or https');
select throws_ok($$ insert into public.site_links (placement, label_en, url) values ('footer', 'Bad', 'http://insecure.test') $$,
  '23514', null, 'site links must be https or internal');
select throws_ok($$ insert into public.menu_items (label_en, url, page_id)
  select 'Both', '/x', id from public.pages limit 1 $$,
  '23514', null, 'a menu item links to a page or a URL, not both');

-- Visitors
update public.menu_items set is_hidden = true where label_en = 'Others';
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.menu_items where label_en = 'Others'), 0, 'anon does not see hidden menu items');
select ok((select count(*) from public.menu_items) > 0, 'anon reads the menu');
select is((select count(*)::int from public.site_links where label_en = 'Draft link (hidden)'), 0,
  'anon does not see unpublished links');
select throws_ok($$ insert into public.menu_items (label_en, url) values ('Hack', '/') $$,
  '42501', null, 'anon cannot add menu items');
select is(pg_temp.affected($$ update public.site_links set url = 'https://evil.test/' $$), 0,
  'anon cannot change links');

-- Public statistics: counts only.
select is((public.public_stats() ->> 'students')::int, 20, 'anon gets the student count');
select is((public.public_stats() ->> 'teachers')::int, 5, 'current teachers only (former staff not counted)');
select is(jsonb_array_length(public.public_stats() -> 'by_class'), 5, 'one row per class');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.public_stats() -> 'by_class' -> 0) k),
  array['level', 'name_bn', 'name_en', 'students'], 'class rows contain only names and counts');
select is((select count(*)::int from public.students), 0, 'anon still cannot read students themselves');

-- Logged-in non-admin cannot edit the menu either.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-a000-000000000003", "role": "authenticated"}';
select is(pg_temp.affected($$ update public.menu_items set label_en = 'x' $$), 0, 'a teacher cannot edit the menu');

select * from finish();
rollback;
