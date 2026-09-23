begin;
create table public."AD_schedules" (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public."AD_cohorts"(id) on delete restrict,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  stage text not null check (stage in ('planning', 'design', 'implementation', 'presentation', 'deliverables', 'other')),
  kind text not null default 'event' check (kind in ('event', 'deadline')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_public boolean not null default false,
  is_cancelled boolean not null default false,
  created_by uuid not null default auth.uid() references public."AD_profiles"(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "AD_schedules_dates_check" check (isfinite(starts_at) and isfinite(ends_at) and ends_at >= starts_at and starts_at >= '0001-01-01T00:00:00+09:00'::timestamptz and ends_at < '10000-01-01T00:00:00+09:00'::timestamptz),
  constraint "AD_schedules_deadline_check" check (kind <> 'deadline' or starts_at = ends_at)
);
create index "AD_schedules_cohort_time" on public."AD_schedules" (cohort_id, starts_at);
create function public."AD_schedules_touch_updated_at"()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function public."AD_schedules_touch_updated_at"() from public, anon, authenticated;
create trigger "AD_schedules_updated_at" before update on public."AD_schedules"
for each row execute function public."AD_schedules_touch_updated_at"();
alter table public."AD_schedules" enable row level security;
revoke all on public."AD_schedules" from anon, authenticated;
grant select on public."AD_schedules" to authenticated;
grant insert (cohort_id, title, description, stage, kind, starts_at, ends_at, is_public, is_cancelled) on public."AD_schedules" to authenticated;
grant update (title, description, stage, kind, starts_at, ends_at, is_public, is_cancelled) on public."AD_schedules" to authenticated;
grant all on public."AD_schedules" to service_role;
create policy "AD_schedules_professor_select" on public."AD_schedules" for select to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active and not p.must_change_password
));
create policy "AD_schedules_professor_insert" on public."AD_schedules" for insert to authenticated with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active and not p.must_change_password
  )
);
create policy "AD_schedules_professor_update" on public."AD_schedules" for update to authenticated using (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active and not p.must_change_password
)) with check (exists (
  select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active and not p.must_change_password
));
create policy "AD_schedules_student_membership" on public."AD_schedules" for select to authenticated using (exists (
  select 1 from public."AD_participants" a join public."AD_profiles" p on p.id = a.profile_id
  where a.cohort_id = "AD_schedules".cohort_id and a.profile_id = (select auth.uid()) and a.status = 'active'
    and p.role = 'student' and p.is_active and not p.must_change_password
));
-- Public projection only: never grant anonymous access to cohort/profile tables.
create function public."AD_public_schedules"()
returns table (id uuid, cohort_id uuid, program_name text, title text, description text, stage text, kind text, starts_at timestamptz, ends_at timestamptz, is_cancelled boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.cohort_id, c.name, s.title, s.description, s.stage, s.kind, s.starts_at, s.ends_at, s.is_cancelled
  from public."AD_schedules" s join public."AD_cohorts" c on c.id = s.cohort_id
  where s.is_public order by s.starts_at, s.id;
$$;
revoke all on function public."AD_public_schedules"() from public, anon, authenticated;
grant execute on function public."AD_public_schedules"() to anon, authenticated, service_role;
commit;
