begin;
create function public."AD_team_url_valid"(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value = '' or (char_length(value) <= 2000 and value ~ '^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$');
$$;
revoke all on function public."AD_team_url_valid"(text) from public, anon, authenticated;
create table public."AD_teams" (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public."AD_cohorts"(id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  topic text not null default '' check (char_length(topic) <= 2000),
  stage text not null default 'planning' check (stage in ('planning', 'design', 'implementation', 'presentation', 'deliverables')),
  notion_url text not null default '' check (public."AD_team_url_valid"(notion_url)),
  github_url text not null default '' check (public."AD_team_url_valid"(github_url)),
  demo_url text not null default '' check (public."AD_team_url_valid"(demo_url)),
  created_by uuid not null default auth.uid() references public."AD_profiles"(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, cohort_id)
);
create unique index "AD_teams_program_name" on public."AD_teams" (cohort_id, lower(name));
-- Composite keys prevent cross-program membership even outside the application RPC.
alter table public."AD_participants" add constraint "AD_participants_id_cohort_unique" unique (id, cohort_id);
create table public."AD_team_members" (
  team_id uuid not null,
  cohort_id uuid not null,
  participant_id uuid primary key,
  is_leader boolean not null default false,
  foreign key (team_id, cohort_id) references public."AD_teams"(id, cohort_id) on delete restrict,
  foreign key (participant_id, cohort_id) references public."AD_participants"(id, cohort_id) on delete restrict
);
create index "AD_team_members_team" on public."AD_team_members"(team_id);
create unique index "AD_team_one_leader" on public."AD_team_members"(team_id) where is_leader;
create function public."AD_teams_touch_updated_at"() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function public."AD_teams_touch_updated_at"() from public, anon, authenticated;
create trigger "AD_teams_updated_at" before update on public."AD_teams" for each row execute function public."AD_teams_touch_updated_at"();
alter table public."AD_teams" enable row level security;
alter table public."AD_team_members" enable row level security;
revoke all on public."AD_teams", public."AD_team_members" from anon, authenticated;
grant select on public."AD_teams" to authenticated;
grant all on public."AD_teams", public."AD_team_members" to service_role;

create function public."AD_is_team_professor"() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active and not p.must_change_password);
$$;
create function public."AD_can_read_team"(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public."AD_is_team_professor"() or exists (
    select 1 from public."AD_team_members" m join public."AD_participants" a on a.id = m.participant_id
      join public."AD_profiles" p on p.id = a.profile_id
    where m.team_id = p_team and p.id = (select auth.uid()) and a.status = 'active'
      and p.role = 'student' and p.is_active and not p.must_change_password
  );
$$;
revoke all on function public."AD_is_team_professor"(), public."AD_can_read_team"(uuid) from public, anon, authenticated;
grant execute on function public."AD_is_team_professor"(), public."AD_can_read_team"(uuid) to authenticated;
create policy "AD_teams_authorized_select" on public."AD_teams" for select to authenticated using (public."AD_can_read_team"(id));

-- Return only the fields required to show colleagues; never expose their contact details.
create function public."AD_team_roster"(p_cohort uuid)
returns table (team_id uuid, participant_id uuid, full_name text, department text, job_group text, is_leader boolean, is_active boolean)
language sql stable security definer set search_path = '' as $$
  select m.team_id, a.id, a.full_name, a.department, a.job_group, m.is_leader,
    a.status = 'active' and coalesce(p.is_active and p.role = 'student', false)
  from public."AD_team_members" m join public."AD_participants" a on a.id = m.participant_id
    left join public."AD_profiles" p on p.id = a.profile_id
  where m.cohort_id = p_cohort and public."AD_can_read_team"(m.team_id)
  order by m.is_leader desc, a.full_name, a.id;
$$;
create function public."AD_team_candidates"(p_cohort uuid)
returns table (participant_id uuid, full_name text, department text, job_group text, team_id uuid, eligibility text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  return query select a.id, a.full_name, a.department, a.job_group, m.team_id,
    case when a.status <> 'active' then 'inactive_participant' when a.profile_id is null then 'unlinked'
      when p.role <> 'student' then 'wrong_role' when not p.is_active then 'inactive_profile' else 'ready' end
  from public."AD_participants" a left join public."AD_profiles" p on p.id = a.profile_id
    left join public."AD_team_members" m on m.participant_id = a.id
  where a.cohort_id = p_cohort order by a.full_name, a.id;
end;
$$;
revoke all on function public."AD_team_roster"(uuid), public."AD_team_candidates"(uuid) from public, anon, authenticated;
grant execute on function public."AD_team_roster"(uuid), public."AD_team_candidates"(uuid) to authenticated;

-- Metadata, membership and leader are saved atomically. Serialize roster edits per program.
create function public."AD_save_team"(p_cohort uuid, p_values jsonb, p_members uuid[], p_leader uuid, p_team uuid default null, p_version timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare team public."AD_teams"%rowtype; result_id uuid; eligible_count integer;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  perform 1 from public."AD_cohorts" where id = p_cohort for update;
  if not found then raise exception 'Program not found' using errcode = '23503'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'Invalid fields' using errcode = '23514'; end if;
  if exists (select 1 from jsonb_object_keys(p_values) k where k not in ('name', 'topic', 'stage', 'notion_url', 'github_url', 'demo_url')) then raise exception 'Unsupported fields' using errcode = '23514'; end if;
  if p_members is null or cardinality(p_members) <> (select count(distinct id) from unnest(p_members) id)
    or (p_leader is not null and not p_leader = any(p_members)) then raise exception 'Invalid members or leader' using errcode = '23514'; end if;
  if p_team is not null then
    select * into team from public."AD_teams" where id = p_team for update;
    if not found or team.cohort_id <> p_cohort or team.updated_at is distinct from p_version then raise exception 'Team changed' using errcode = '40001'; end if;
  end if;
  -- Hold eligibility stable until the membership transaction commits.
  perform 1 from public."AD_participants" a where a.id = any(p_members) order by a.id for share;
  perform 1 from public."AD_profiles" p where p.id in (select a.profile_id from public."AD_participants" a where a.id = any(p_members)) order by p.id for share;
  select count(*) into eligible_count from public."AD_participants" a join public."AD_profiles" p on p.id = a.profile_id
    where a.id = any(p_members) and a.cohort_id = p_cohort and a.status = 'active' and p.role = 'student' and p.is_active;
  if eligible_count <> cardinality(p_members) then raise exception 'Member account or participation is ineligible' using errcode = '23514'; end if;
  if exists (select 1 from public."AD_team_members" m where m.participant_id = any(p_members) and m.team_id is distinct from p_team) then
    raise exception 'Member already assigned' using errcode = '23505';
  end if;
  if p_team is null then
    insert into public."AD_teams" (cohort_id, name, topic, stage, notion_url, github_url, demo_url)
      values (p_cohort, btrim(p_values->>'name'), p_values->>'topic', p_values->>'stage', p_values->>'notion_url', p_values->>'github_url', p_values->>'demo_url') returning id into result_id;
  else
    update public."AD_teams" set name = btrim(p_values->>'name'), topic = p_values->>'topic', stage = p_values->>'stage',
      notion_url = p_values->>'notion_url', github_url = p_values->>'github_url', demo_url = p_values->>'demo_url' where id = p_team;
    result_id := p_team;
    delete from public."AD_team_members" where team_id = p_team;
  end if;
  insert into public."AD_team_members" (team_id, cohort_id, participant_id, is_leader)
    select result_id, p_cohort, id, coalesce(id = p_leader, false) from unnest(p_members) id;
  return result_id;
end;
$$;
create function public."AD_update_team_project"(p_team uuid, p_version timestamptz, p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare team public."AD_teams"%rowtype;
begin
  select * into team from public."AD_teams" where id = p_team for update;
  if not found or not public."AD_can_read_team"(p_team) then raise exception 'Team permission required' using errcode = '42501'; end if;
  if team.updated_at is distinct from p_version then raise exception 'Team changed' using errcode = '40001'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'Invalid fields' using errcode = '23514'; end if;
  if exists (select 1 from jsonb_object_keys(p_values) k where k not in ('topic', 'stage', 'notion_url', 'github_url', 'demo_url')) then raise exception 'Unsupported fields' using errcode = '42501'; end if;
  update public."AD_teams" set topic = p_values->>'topic', stage = p_values->>'stage',
    notion_url = p_values->>'notion_url', github_url = p_values->>'github_url', demo_url = p_values->>'demo_url' where id = p_team;
  return p_team;
end;
$$;
create function public."AD_delete_empty_team"(p_team uuid, p_version timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare team public."AD_teams"%rowtype;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  select * into team from public."AD_teams" where id = p_team for update;
  if not found or team.updated_at is distinct from p_version then raise exception 'Team changed' using errcode = '40001'; end if;
  if exists (select 1 from public."AD_team_members" where team_id = p_team) then raise exception 'Remove members before deletion' using errcode = '23503'; end if;
  -- Future submissions must reference AD_teams with ON DELETE RESTRICT.
  delete from public."AD_teams" where id = p_team;
  return p_team;
end;
$$;
revoke all on function public."AD_save_team"(uuid, jsonb, uuid[], uuid, uuid, timestamptz), public."AD_update_team_project"(uuid, timestamptz, jsonb), public."AD_delete_empty_team"(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public."AD_save_team"(uuid, jsonb, uuid[], uuid, uuid, timestamptz), public."AD_update_team_project"(uuid, timestamptz, jsonb), public."AD_delete_empty_team"(uuid, timestamptz) to authenticated;
commit;
