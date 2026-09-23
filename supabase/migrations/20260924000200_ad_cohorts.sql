begin;

create table public."AD_cohorts" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  starts_on date,
  ends_on date,
  status text not null default 'draft',
  created_by uuid not null default auth.uid() references public."AD_profiles"(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "AD_cohorts_name_check" check (name = btrim(name) and char_length(name) between 1 and 80),
  constraint "AD_cohorts_description_check" check (char_length(description) <= 2000),
  constraint "AD_cohorts_status_check" check (status in ('draft', 'active', 'completed')),
  constraint "AD_cohorts_dates_check" check (
    (starts_on is null and ends_on is null)
    or (starts_on is not null and ends_on is not null and ends_on >= starts_on)
  )
);
create unique index "AD_cohorts_name_unique" on public."AD_cohorts" (lower(name));

create function public."AD_cohorts_touch_updated_at"()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public."AD_cohorts_touch_updated_at"() from public, anon, authenticated;
create trigger "AD_cohorts_updated_at" before update on public."AD_cohorts"
  for each row execute function public."AD_cohorts_touch_updated_at"();

alter table public."AD_cohorts" enable row level security;
revoke all on public."AD_cohorts" from anon, authenticated;
grant select on public."AD_cohorts" to authenticated;
grant insert (name, description, starts_on, ends_on, status) on public."AD_cohorts" to authenticated;
grant update (name, description, starts_on, ends_on, status) on public."AD_cohorts" to authenticated;
grant all on public."AD_cohorts" to service_role;

-- Only the confirmed professor role is enabled for now. Other roles remain pending policy approval.
create policy "AD_cohorts_professor_select" on public."AD_cohorts"
for select to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
));
create policy "AD_cohorts_professor_insert" on public."AD_cohorts"
for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
  )
);
create policy "AD_cohorts_professor_update" on public."AD_cohorts"
for update to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
)) with check (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active
));

-- Retain cohorts for historical records; no client DELETE privilege or policy.
commit;
