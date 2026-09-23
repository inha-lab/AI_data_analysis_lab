begin;

create table public."AD_participants" (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public."AD_cohorts"(id) on delete restrict,
  profile_id uuid references public."AD_profiles"(id) on delete restrict,
  full_name text not null,
  email text not null,
  department text not null,
  student_number text not null,
  grade text not null,
  phone text not null,
  job_group text not null,
  status text not null default 'active',
  created_by uuid not null default auth.uid() references public."AD_profiles"(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "AD_participants_name_check" check (full_name = btrim(full_name) and char_length(full_name) between 1 and 80),
  constraint "AD_participants_department_check" check (department = btrim(department) and char_length(department) between 1 and 100),
  constraint "AD_participants_number_check" check (student_number = btrim(student_number) and char_length(student_number) between 1 and 40),
  constraint "AD_participants_grade_check" check (grade = btrim(grade) and char_length(grade) between 1 and 30),
  constraint "AD_participants_email_check" check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint "AD_participants_phone_check" check (phone = btrim(phone) and char_length(phone) <= 30 and phone ~ '^[+0-9() .-]+$' and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 9 and 15),
  constraint "AD_participants_job_check" check (job_group in ('sw_engineering', 'sw_development', 'ai_development')),
  constraint "AD_participants_status_check" check (status in ('active', 'inactive')),
  constraint "AD_participants_cohort_email_unique" unique (cohort_id, email),
  constraint "AD_participants_cohort_number_unique" unique (cohort_id, student_number),
  constraint "AD_participants_cohort_profile_unique" unique (cohort_id, profile_id)
);
create index "AD_participants_profile_idx" on public."AD_participants" (profile_id);

create function public."AD_participants_touch_updated_at"()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public."AD_participants_touch_updated_at"() from public, anon, authenticated;
create trigger "AD_participants_updated_at" before update on public."AD_participants"
  for each row execute function public."AD_participants_touch_updated_at"();

alter table public."AD_participants" enable row level security;
revoke all on public."AD_participants" from anon, authenticated;
grant select on public."AD_participants" to authenticated;
grant insert (cohort_id, full_name, email, department, student_number, grade, phone, job_group, status) on public."AD_participants" to authenticated;
grant update (full_name, email, department, student_number, grade, phone, job_group, status) on public."AD_participants" to authenticated;
grant all on public."AD_participants" to service_role;

create policy "AD_participants_professor_select" on public."AD_participants"
for select to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
));
create policy "AD_participants_professor_insert" on public."AD_participants"
for insert to authenticated with check (
  created_by = (select auth.uid()) and profile_id is null and exists (
    select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
  )
);
create policy "AD_participants_professor_update" on public."AD_participants"
for update to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
)) with check (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
));

-- Participation is independent of Auth. No account creation, passwords or shared Auth triggers.
-- Only trusted future provisioning may assign profile_id; clients cannot change cohort_id after creation.
commit;
