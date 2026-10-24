-- Step 1.2 / 1: shared types and helpers.

create type public.app_role as enum ('super_admin', 'admin', 'teacher', 'accountant', 'student', 'guardian');
create type public.gender as enum ('male', 'female', 'other');
create type public.religion as enum ('islam', 'hinduism', 'buddhism', 'christianity', 'other');
create type public.blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
create type public.student_status as enum ('active', 'inactive', 'transferred', 'graduated');
create type public.subject_type as enum ('compulsory', 'optional', 'fourth');
create type public.attendance_status as enum ('present', 'absent', 'late', 'leave');
create type public.exam_status as enum ('draft', 'marks_entry', 'review', 'published');
create type public.notice_category as enum ('general', 'exam', 'result', 'admission', 'holiday');
create type public.notice_audience as enum ('public', 'staff', 'class');
create type public.fee_frequency as enum ('monthly', 'one_time');
create type public.waiver_kind as enum ('percent', 'fixed');
create type public.invoice_status as enum ('unpaid', 'partial', 'paid', 'cancelled');

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bangladesh mobile number: 01 + operator digit 3-9 + 8 digits (11 digits total).
create function public.is_bd_phone(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^01[3-9][0-9]{8}$';
$$;
