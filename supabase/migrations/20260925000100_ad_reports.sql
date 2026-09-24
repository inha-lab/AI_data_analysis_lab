begin;
create table public."AD_reports" (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public."AD_teams"(id) on delete restrict,
  report_type text not null check (report_type in ('daily','weekly')),
  round_number integer not null check (round_number between 1 and 1000),
  report_date date not null check (isfinite(report_date)),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  progress_summary text not null default '' check (char_length(progress_summary) <= 8000),
  completed_work text not null default '' check (char_length(completed_work) <= 8000),
  next_plan text not null default '' check (char_length(next_plan) <= 8000),
  issues text not null default '' check (char_length(issues) <= 8000),
  support_request text not null default '' check (char_length(support_request) <= 8000),
  status text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  submitted_at timestamptz,
  submitted_by uuid references public."AD_profiles"(id) on delete restrict,
  submitted_name text,
  review_note text not null default '' check (char_length(review_note) <= 4000),
  review_action text check (review_action in ('reviewed','returned')),
  reviewed_at timestamptz,
  reviewed_by uuid references public."AD_profiles"(id) on delete restrict,
  reviewer_name text,
  updated_by uuid not null references public."AD_profiles"(id) on delete restrict,
  updated_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "AD_reports_team_type_round_unique" unique (team_id,report_type,round_number),
  constraint "AD_reports_complete_submission" check (status = 'draft' or (
    btrim(progress_summary) <> '' and btrim(completed_work) <> '' and btrim(next_plan) <> ''
    and submitted_at is not null and submitted_by is not null
  )),
  constraint "AD_reports_review_metadata" check (status <> 'reviewed' or (review_action is not distinct from 'reviewed' and reviewed_at is not null and reviewed_by is not null))
);
create index "AD_reports_team_type_date" on public."AD_reports" (team_id,report_type,report_date desc);
create function public."AD_reports_touch_updated_at"() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function public."AD_reports_touch_updated_at"() from public,anon,authenticated;
create trigger "AD_reports_updated_at" before update on public."AD_reports" for each row execute function public."AD_reports_touch_updated_at"();
alter table public."AD_reports" enable row level security;
revoke all on public."AD_reports" from anon,authenticated;
grant select on public."AD_reports" to authenticated;
grant all on public."AD_reports" to service_role;
create policy "AD_reports_team_select" on public."AD_reports" for select to authenticated using (public."AD_can_read_team"(team_id));

create function public."AD_save_report"(p_team uuid,p_report uuid,p_version timestamptz,p_values jsonb,p_submit boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_reports"%rowtype; actor_name text; field text; result_id uuid; next_status text;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists (
    select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password
  ) then raise exception 'Current student membership required' using errcode='42501'; end if;
  select coalesce(nullif(display_name,''),'학생') into actor_name from public."AD_profiles" where id=auth.uid();
  if p_report is not null then
    select * into previous from public."AD_reports" where id=p_report and team_id=p_team for update;
    if not found or previous.updated_at is distinct from p_version then raise exception 'Report changed' using errcode='40001'; end if;
    if previous.status='reviewed' then raise exception 'Reviewed report is locked until returned' using errcode='55000'; end if;
  end if;
  if p_submit is null or p_values is null or jsonb_typeof(p_values)<>'object' or (select count(*) from jsonb_object_keys(p_values))<>9 then raise exception 'Invalid fields' using errcode='23514'; end if;
  foreach field in array array['report_type','round_number','report_date','title','progress_summary','completed_work','next_plan','issues','support_request'] loop
    if jsonb_typeof(p_values->field) is distinct from 'string' then raise exception 'Missing text field' using errcode='23514'; end if;
  end loop;
  if (p_values->>'round_number') !~ '^[0-9]{1,4}$' then raise exception 'Invalid round' using errcode='23514'; end if;
  next_status := case when p_submit then 'submitted' when p_report is null then 'draft' else previous.status end;
  if p_report is null then
    insert into public."AD_reports"(team_id,report_type,round_number,report_date,title,progress_summary,completed_work,next_plan,issues,support_request,status,submitted_at,submitted_by,submitted_name,updated_by,updated_name)
      values (p_team,p_values->>'report_type',(p_values->>'round_number')::integer,(p_values->>'report_date')::date,btrim(p_values->>'title'),p_values->>'progress_summary',p_values->>'completed_work',p_values->>'next_plan',p_values->>'issues',p_values->>'support_request',next_status,
        case when p_submit then clock_timestamp() end,case when p_submit then auth.uid() end,case when p_submit then actor_name end,auth.uid(),actor_name)
      returning id into result_id;
  else
    update public."AD_reports" set report_type=p_values->>'report_type',round_number=(p_values->>'round_number')::integer,report_date=(p_values->>'report_date')::date,
      title=btrim(p_values->>'title'),progress_summary=p_values->>'progress_summary',completed_work=p_values->>'completed_work',next_plan=p_values->>'next_plan',
      issues=p_values->>'issues',support_request=p_values->>'support_request',status=next_status,
      submitted_at=case when p_submit then clock_timestamp() else submitted_at end,
      submitted_by=case when p_submit then auth.uid() else submitted_by end,
      submitted_name=case when p_submit then actor_name else submitted_name end,
      updated_by=auth.uid(),updated_name=actor_name where id=p_report returning id into result_id;
  end if;
  return result_id;
end;
$$;
create function public."AD_review_report"(p_report uuid,p_version timestamptz,p_action text,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_reports"%rowtype; actor_name text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  -- Keep lock order consistent with student saves and team deletion.
  perform 1 from public."AD_teams" where id=(select team_id from public."AD_reports" where id=p_report) for update;
  select * into previous from public."AD_reports" where id=p_report for update;
  if not found or previous.updated_at is distinct from p_version then raise exception 'Report changed' using errcode='40001'; end if;
  if p_action is null or p_action not in ('reviewed','returned') or p_note is null or char_length(p_note)>4000 then raise exception 'Invalid review' using errcode='23514'; end if;
  if (p_action='reviewed' and previous.status<>'submitted') or (p_action='returned' and previous.status not in ('submitted','reviewed')) then raise exception 'Invalid review transition' using errcode='55000'; end if;
  if p_action='returned' and btrim(p_note)='' then raise exception 'Return reason required' using errcode='23514'; end if;
  select coalesce(nullif(display_name,''),'교수') into actor_name from public."AD_profiles" where id=auth.uid();
  update public."AD_reports" set status=case when p_action='reviewed' then 'reviewed' else 'draft' end,
    review_note=btrim(p_note),review_action=p_action,reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),reviewer_name=actor_name,
    updated_by=auth.uid(),updated_name=actor_name where id=p_report;
  return p_report;
end;
$$;
revoke all on function public."AD_save_report"(uuid,uuid,timestamptz,jsonb,boolean),public."AD_review_report"(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public."AD_save_report"(uuid,uuid,timestamptz,jsonb,boolean),public."AD_review_report"(uuid,timestamptz,text,text) to authenticated;
commit;
