begin;
alter table public."AD_team_members" add column role_title text not null default '' check (role_title=btrim(role_title) and char_length(role_title)<=80);

create function public."AD_team_roster_v2"(p_cohort uuid)
returns table(team_id uuid,participant_id uuid,full_name text,department text,job_group text,is_leader boolean,is_active boolean,role_title text)
language sql stable security definer set search_path='' as $$
  select m.team_id,a.id,a.full_name,a.department,a.job_group,m.is_leader,
    a.status='active' and coalesce(p.is_active and p.role='student',false),m.role_title
  from public."AD_team_members" m join public."AD_participants" a on a.id=m.participant_id
    left join public."AD_profiles" p on p.id=a.profile_id
  where m.cohort_id=p_cohort and public."AD_can_read_team"(m.team_id)
  order by m.is_leader desc,a.full_name,a.id;
$$;
revoke all on function public."AD_team_roster_v2"(uuid) from public,anon,authenticated;
grant execute on function public."AD_team_roster_v2"(uuid) to authenticated;

create or replace function public."AD_team_workspace"(p_cohort uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'teams',coalesce((select jsonb_agg(t order by t.name,t.id) from (
      select id,cohort_id,name,topic,stage,notion_url,github_url,demo_url,updated_at
      from public."AD_teams" where cohort_id=p_cohort and public."AD_can_read_team"(id)
    ) t),'[]'::jsonb),
    'roster',coalesce((select jsonb_agg(r) from public."AD_team_roster_v2"(p_cohort) r),'[]'::jsonb),
    'candidates',case when public."AD_is_team_professor"()
      then coalesce((select jsonb_agg(c) from public."AD_team_candidates"(p_cohort) c),'[]'::jsonb)
      else '[]'::jsonb end
  );
$$;

create function public."AD_save_team_v2"(p_cohort uuid,p_values jsonb,p_members uuid[],p_leader uuid,p_team uuid,p_version timestamptz,p_roles jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; member_id uuid; role_value text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501';end if;
  if p_roles is null or jsonb_typeof(p_roles)<>'object' or exists(
    select 1 from jsonb_each(p_roles) entry where jsonb_typeof(entry.value)<>'string'
      or entry.key not in (select members.id::text from unnest(p_members) as members(id))
      or char_length(btrim(entry.value#>>'{}'))>80
  ) then raise exception 'Invalid team member roles' using errcode='23514';end if;
  result_id:=public."AD_save_team"(p_cohort,p_values,p_members,p_leader,p_team,p_version);
  foreach member_id in array p_members loop
    role_value:=btrim(coalesce(p_roles->>member_id::text,''));
    update public."AD_team_members" set role_title=role_value where team_id=result_id and participant_id=member_id;
  end loop;
  return result_id;
end;
$$;
revoke execute on function public."AD_save_team"(uuid,jsonb,uuid[],uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public."AD_save_team_v2"(uuid,jsonb,uuid[],uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public."AD_save_team_v2"(uuid,jsonb,uuid[],uuid,uuid,timestamptz,jsonb) to authenticated;

create function public."AD_team_full_report_v2"(p_team uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; team_cohort uuid;
begin
  base:=public."AD_team_full_report"(p_team);
  select cohort_id into team_cohort from public."AD_teams" where id=p_team;
  return jsonb_set(base,'{members}',coalesce((select jsonb_agg(jsonb_build_object(
    'full_name',m.full_name,'department',m.department,'job_group',m.job_group,
    'is_leader',m.is_leader,'is_active',m.is_active,'role_title',m.role_title
  ) order by m.is_leader desc,m.full_name) from public."AD_team_roster_v2"(team_cohort) m where m.team_id=p_team),'[]'::jsonb));
end;
$$;
revoke all on function public."AD_team_full_report_v2"(uuid) from public,anon,authenticated;
grant execute on function public."AD_team_full_report_v2"(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
