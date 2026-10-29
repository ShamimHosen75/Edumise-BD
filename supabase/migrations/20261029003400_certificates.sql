-- Step 4.4: certificates (WEB-12). Testimonial, transfer and character certificates with
-- a random reference (open question 34) that anyone can verify through the website. A
-- certificate never changes after it is issued; it can only be revoked.

create table public.certificates (
  id bigint generated always as identity primary key,
  -- e.g. TC-7KQ2-M9XA-4P: type prefix + 10 random characters (no 0, O, 1, I, L).
  reference text not null unique
    check (reference ~ '^(TS|TC|CC)-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$'),
  type text not null check (type in ('testimonial', 'transfer', 'character')),
  student_id bigint references public.students (id) on delete set null,
  -- The name as printed, kept even if the student record changes or is removed.
  student_name_en text not null check (length(trim(student_name_en)) > 0),
  student_name_bn text not null default '',
  body_en text not null check (length(body_en) between 1 and 4000),
  body_bn text not null default '' check (length(body_bn) <= 4000),
  issued_on date not null default (now() at time zone 'Asia/Dhaka')::date,
  issued_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (length(revoke_reason) <= 500),
  created_at timestamptz not null default now(),
  check (left(reference, 2) = case type when 'testimonial' then 'TS' when 'transfer' then 'TC' else 'CC' end),
  check (revoked_at is not null or (revoked_by is null and revoke_reason is null))
);
create index certificates_student_idx on public.certificates (student_id);
alter table public.certificates enable row level security;

-- Admins read; every write goes through the functions below.
create policy "admins read certificates" on public.certificates
  for select to authenticated using ((select app.is_admin()));

/**
 * Issues a certificate. A transfer certificate also marks the student as transferred
 * (open question 36; the page asks first). Errors: 42501 not an admin, 22023 no such
 * student, 23505 reference already used (the caller retries with a new one).
 */
create function public.issue_certificate(p_student_id bigint, p_type text, p_reference text,
  p_body_en text, p_body_bn text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_id bigint;
begin
  if not app.is_admin() then
    raise exception 'only admins issue certificates' using errcode = '42501';
  end if;
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'no such student' using errcode = '22023';
  end if;
  insert into public.certificates (reference, type, student_id, student_name_en, student_name_bn,
    body_en, body_bn, issued_by)
  values (p_reference, p_type, p_student_id, v_student.full_name_en, v_student.full_name_bn,
    p_body_en, coalesce(p_body_bn, ''), auth.uid())
  returning id into v_id;
  if p_type = 'transfer' then
    update public.students set status = 'transferred' where id = p_student_id;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'certificate.issued', 'certificate', v_id::text,
    jsonb_build_object('type', p_type, 'student_id', p_student_id, 'reference', p_reference));
  return v_id;
end;
$$;
revoke execute on function public.issue_certificate(bigint, text, text, text, text) from public, anon;
grant execute on function public.issue_certificate(bigint, text, text, text, text) to authenticated;

/** Revokes a certificate (once). Returns false if it was already revoked or not found. */
create function public.revoke_certificate(p_id bigint, p_reason text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admins revoke certificates' using errcode = '42501';
  end if;
  update public.certificates
  set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = nullif(trim(p_reason), '')
  where id = p_id and revoked_at is null;
  if not found then
    return false;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'certificate.revoked', 'certificate', p_id::text,
    jsonb_build_object('reason', p_reason));
  return true;
end;
$$;
revoke execute on function public.revoke_certificate(bigint, text) from public, anon;
grant execute on function public.revoke_certificate(bigint, text) to authenticated;

/**
 * What the public verify page may show: name, type, issue date and status. Nothing else
 * (no class, ID, birth date or body text). Called by the server after its rate limit.
 */
create function public.verify_certificate(p_reference text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'reference', c.reference, 'type', c.type,
    'name_en', c.student_name_en, 'name_bn', c.student_name_bn,
    'issued_on', c.issued_on, 'revoked', c.revoked_at is not null,
    'revoked_on', (c.revoked_at at time zone 'Asia/Dhaka')::date)
  from public.certificates c
  where c.reference = p_reference;
$$;
revoke execute on function public.verify_certificate(text) from public, anon, authenticated;
grant execute on function public.verify_certificate(text) to service_role;
