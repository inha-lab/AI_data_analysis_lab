begin;

-- Deliberately fail on an existing table: inspect collisions before applying.
create table public."AD_profiles" (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  phone text,
  role text not null default 'student'
    check (role in ('professor', 'consultant', 'researcher', 'student')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."AD_profiles" enable row level security;
revoke all on public."AD_profiles" from anon, authenticated;
grant select on public."AD_profiles" to authenticated;
grant all on public."AD_profiles" to service_role;

create policy "AD_profiles_select_self" on public."AD_profiles"
  for select to authenticated
  using ((select auth.uid()) = id and is_active = true);

-- No client writes: membership and roles are assigned by trusted admin operations.
-- No shared Auth triggers, existing application tables or policies are modified.
commit;
