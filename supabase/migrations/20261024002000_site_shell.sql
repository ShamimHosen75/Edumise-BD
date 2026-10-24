-- Step 2.1: menu, quick/footer links and public statistics for the home page.

-- Menu: two levels (top-level menus and their items). An item links to a CMS page or a URL;
-- a top-level menu with neither is just a heading for its children.
create table public.menu_items (
  id bigint generated always as identity primary key,
  parent_id bigint references public.menu_items (id) on delete cascade,
  label_en text not null,
  label_bn text not null default '',
  page_id bigint references public.pages (id) on delete set null,
  url text,
  sort_order smallint not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (page_id is null or url is null),
  -- Internal paths (without the language) or https links only.
  check (url is null or url ~ '^/[a-z0-9/_-]*$' or url ~ '^https://[^\s<>"]+$')
);
create index menu_items_parent_idx on public.menu_items (parent_id, sort_order);

create function public.check_menu_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null
     and exists (select 1 from public.menu_items where id = new.parent_id and parent_id is not null) then
    raise exception 'Menus have at most two levels' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger menu_items_depth before insert or update on public.menu_items
  for each row execute function public.check_menu_depth();
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create type public.link_placement as enum ('quick', 'footer');

create table public.site_links (
  id bigint generated always as identity primary key,
  placement public.link_placement not null,
  label_en text not null,
  label_bn text not null default '',
  url text not null check (url ~ '^/[a-z0-9/_-]*$' or url ~ '^https://[^\s<>"]+$'),
  icon text not null default 'link' check (icon ~ '^[a-z-]+$'),
  sort_order smallint not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger site_links_updated_at before update on public.site_links
  for each row execute function public.set_updated_at();

alter table public.menu_items enable row level security;
alter table public.site_links enable row level security;

create policy "anyone reads visible menu items" on public.menu_items
  for select to anon, authenticated using (not is_hidden or (select app.is_admin()));
create policy "admins manage menu items" on public.menu_items
  for all to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy "anyone reads published links" on public.site_links
  for select to anon, authenticated using (is_published or (select app.is_admin()));
create policy "admins manage links" on public.site_links
  for all to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

-- Totals for the home page counters and class chart. Only counts leave this function,
-- never names or other student data (students stay private under RLS).
create function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with current_enrolments as (
    select e.section_id
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where e.session_id = (select id from public.academic_sessions where is_current)
      and s.status = 'active'
  )
  select jsonb_build_object(
    'classes', (select count(*) from public.classes),
    'students', (select count(*) from current_enrolments),
    'teachers', (select count(*) from public.staff st join public.designations d on d.id = st.designation_id
                 where d.is_teaching and st.left_on is null),
    'staff', (select count(*) from public.staff st join public.designations d on d.id = st.designation_id
              where not d.is_teaching and st.left_on is null),
    'by_class', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'level', c.level, 'name_en', c.name_en, 'name_bn', c.name_bn, 'students', coalesce(n.count, 0))
             order by c.level), '[]'::jsonb)
      from public.classes c
      left join (
        select sec.class_id, count(*) as count
        from current_enrolments ce join public.sections sec on sec.id = ce.section_id
        group by sec.class_id
      ) n on n.class_id = c.id
    )
  );
$$;

revoke execute on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated, service_role;
