begin;
create table public."AD_proposals" (
  team_id uuid primary key references public."AD_teams"(id) on delete restrict,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  overview text not null default '' check (char_length(overview) <= 8000),
  data_plan text not null default '' check (char_length(data_plan) <= 8000),
  methods text not null default '' check (char_length(methods) <= 8000),
  validation text not null default '' check (char_length(validation) <= 8000),
  service_plan text not null default '' check (char_length(service_plan) <= 8000),
  execution_plan text not null default '' check (char_length(execution_plan) <= 8000),
  notion_url text not null default '' check (public."AD_team_url_valid"(notion_url)),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz,
  submitted_by uuid references public."AD_profiles"(id) on delete restrict,
  submitted_name text,
  review_note text not null default '' check (char_length(review_note) <= 4000),
  review_action text check (review_action in ('reviewed', 'returned')),
  reviewed_at timestamptz,
  reviewed_by uuid references public."AD_profiles"(id) on delete restrict,
  reviewer_name text,
  updated_by uuid not null references public."AD_profiles"(id) on delete restrict,
  updated_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "AD_proposals_complete_submission" check (status = 'draft' or (
    btrim(overview) <> '' and btrim(data_plan) <> '' and btrim(methods) <> '' and btrim(validation) <> '' and btrim(service_plan) <> '' and btrim(execution_plan) <> ''
    and submitted_at is not null and submitted_by is not null
  )),
  constraint "AD_proposals_review_metadata" check (status <> 'reviewed' or (review_action is not distinct from 'reviewed' and reviewed_at is not null and reviewed_by is not null))
);
create function public."AD_proposals_touch_updated_at"() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function public."AD_proposals_touch_updated_at"() from public, anon, authenticated;
create trigger "AD_proposals_updated_at" before update on public."AD_proposals" for each row execute function public."AD_proposals_touch_updated_at"();
alter table public."AD_proposals" enable row level security;
revoke all on public."AD_proposals" from anon, authenticated;
grant select on public."AD_proposals" to authenticated;
grant all on public."AD_proposals" to service_role;
create policy "AD_proposals_team_select" on public."AD_proposals" for select to authenticated using (public."AD_can_read_team"(team_id));

create function public."AD_save_proposal"(p_team uuid, p_version timestamptz, p_values jsonb, p_submit boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_proposals"%rowtype; actor_name text; field text;
begin
  -- Team lock serializes membership changes, first drafts and review operations.
  perform 1 from public."AD_teams" where id = p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists (
    select 1 from public."AD_profiles" where id = auth.uid() and role = 'student' and is_active and not must_change_password
  ) then raise exception 'Current student membership required' using errcode = '42501'; end if;
  select coalesce(nullif(display_name, ''), '학생') into actor_name from public."AD_profiles" where id = auth.uid();
  select * into previous from public."AD_proposals" where team_id = p_team;
  if previous.updated_at is distinct from p_version then raise exception 'Proposal changed' using errcode = '40001'; end if;
  if previous.status is not null and previous.status <> 'draft' then raise exception 'Submitted proposal is locked until returned' using errcode = '55000'; end if;
  if p_submit is null or p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'Invalid fields' using errcode = '23514'; end if;
  if (select count(*) from jsonb_object_keys(p_values)) <> 8 then raise exception 'Unexpected fields' using errcode = '23514'; end if;
  foreach field in array array['title','overview','data_plan','methods','validation','service_plan','execution_plan','notion_url'] loop
    if jsonb_typeof(p_values->field) is distinct from 'string' then raise exception 'Missing text field' using errcode = '23514'; end if;
  end loop;
  insert into public."AD_proposals" (team_id,title,overview,data_plan,methods,validation,service_plan,execution_plan,notion_url,status,submitted_at,submitted_by,submitted_name,updated_by,updated_name)
    values (p_team,btrim(p_values->>'title'),p_values->>'overview',p_values->>'data_plan',p_values->>'methods',p_values->>'validation',p_values->>'service_plan',p_values->>'execution_plan',p_values->>'notion_url',
      case when p_submit then 'submitted' else 'draft' end,case when p_submit then clock_timestamp() end,case when p_submit then auth.uid() end,case when p_submit then actor_name end,auth.uid(),actor_name)
  on conflict (team_id) do update set title=excluded.title,overview=excluded.overview,data_plan=excluded.data_plan,methods=excluded.methods,validation=excluded.validation,
    service_plan=excluded.service_plan,execution_plan=excluded.execution_plan,notion_url=excluded.notion_url,status=excluded.status,
    submitted_at=case when p_submit then excluded.submitted_at else "AD_proposals".submitted_at end,
    submitted_by=case when p_submit then excluded.submitted_by else "AD_proposals".submitted_by end,
    submitted_name=case when p_submit then excluded.submitted_name else "AD_proposals".submitted_name end,
    updated_by=excluded.updated_by,updated_name=excluded.updated_name;
  return p_team;
end;
$$;
create function public."AD_review_proposal"(p_team uuid, p_version timestamptz, p_action text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_proposals"%rowtype; actor_name text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  perform 1 from public."AD_teams" where id = p_team for update;
  select * into previous from public."AD_proposals" where team_id = p_team;
  if not found or previous.updated_at is distinct from p_version then raise exception 'Proposal changed' using errcode = '40001'; end if;
  if p_action is null or p_action not in ('reviewed','returned') or p_note is null or char_length(p_note) > 4000 then raise exception 'Invalid review' using errcode = '23514'; end if;
  if (p_action = 'reviewed' and previous.status <> 'submitted') or (p_action = 'returned' and previous.status not in ('submitted','reviewed')) then raise exception 'Invalid review transition' using errcode = '55000'; end if;
  if p_action = 'returned' and btrim(p_note) = '' then raise exception 'Return reason required' using errcode = '23514'; end if;
  select coalesce(nullif(display_name, ''), '교수') into actor_name from public."AD_profiles" where id = auth.uid();
  update public."AD_proposals" set status=case when p_action='reviewed' then 'reviewed' else 'draft' end,
    review_note=btrim(p_note),review_action=p_action,reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),reviewer_name=actor_name,updated_by=auth.uid(),updated_name=actor_name
    where team_id = p_team;
  return p_team;
end;
$$;
revoke all on function public."AD_save_proposal"(uuid,timestamptz,jsonb,boolean), public."AD_review_proposal"(uuid,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public."AD_save_proposal"(uuid,timestamptz,jsonb,boolean), public."AD_review_proposal"(uuid,timestamptz,text,text) to authenticated;
commit;
