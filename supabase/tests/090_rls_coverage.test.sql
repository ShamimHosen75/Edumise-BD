-- Step 1.3: RLS coverage and the JWT hook.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Acceptance: no table in public has RLS disabled.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity = false),
  0, 'no public table has row level security disabled'
);

select is(
  (select array_agg(t.tablename::text order by t.tablename) from pg_tables t
   where t.schemaname = 'public'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)),
  null, 'every public table has at least one explicit policy'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""')),
  0, 'every app helper has an empty fixed search_path'
);

select ok(
  (select bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname in
     ('auth_role', 'is_staff', 'is_admin', 'teacher_section_ids', 'guardian_student_ids', 'my_student_id')),
  'the six required helpers are SECURITY DEFINER'
);

select ok(not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'anon cannot call the token hook');
select ok(not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'logged-in users cannot call the token hook');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-4000-a000-000000000003', 'claims', '{"sub": "x"}'::jsonb)) #>> '{claims,app_role}',
  'teacher', 'the token hook adds app_role from profiles'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', gen_random_uuid(), 'claims', '{}'::jsonb)) #> '{claims,app_role}',
  'null'::jsonb, 'the token hook sets app_role to null for an unknown user'
);

update public.profiles set is_active = false where id = '00000000-0000-4000-a000-000000000003';
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-4000-a000-000000000003', 'claims', '{}'::jsonb)) #> '{claims,app_role}',
  'null'::jsonb, 'an inactive user gets no role in the token'
);

select * from finish();
rollback;
