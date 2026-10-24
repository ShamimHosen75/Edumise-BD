-- Smoke test: pgTAP runs against the local database. Real RLS tests arrive in Step 1.3.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select has_schema('public', 'public schema exists');
select has_extension('pgtap', 'pgtap is installed');
select * from finish();
rollback;
