begin;
alter table public."AD_participants" add column gender text not null default 'unspecified' check (gender in ('unspecified','male','female'));
grant insert (gender) on public."AD_participants" to authenticated;
grant update (gender) on public."AD_participants" to authenticated;
create or replace function public."AD_team_workspace"(p_cohort uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'teams',coalesce((select jsonb_agg(t order by t.name,t.id) from (select id,cohort_id,name,topic,stage,notion_url,github_url,demo_url,updated_at from public."AD_teams" where cohort_id=p_cohort and public."AD_can_read_team"(id)) t),'[]'::jsonb),
    'roster',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('grade',a.grade,'gender',a.gender)) from public."AD_team_roster_v2"(p_cohort) r join public."AD_participants" a on a.id=r.participant_id),'[]'::jsonb),
    'candidates',case when public."AD_is_team_professor"() then coalesce((select jsonb_agg(c) from public."AD_team_candidates"(p_cohort) c),'[]'::jsonb) else '[]'::jsonb end,
    'my_participant_id',(select a.id from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id where a.cohort_id=p_cohort and a.profile_id=auth.uid() and a.status='active' and p.role='student' and p.is_active and not p.must_change_password limit 1));
$$;
create or replace function public."AD_team_full_report_v2"(p_team uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; team_cohort uuid;
begin
  base:=public."AD_team_full_report"(p_team); select cohort_id into team_cohort from public."AD_teams" where id=p_team;
  return jsonb_set(base,'{members}',coalesce((select jsonb_agg(jsonb_build_object('full_name',m.full_name,'department',m.department,'grade',a.grade,'gender',a.gender,'job_group',m.job_group,'is_leader',m.is_leader,'is_active',m.is_active,'role_title',m.role_title) order by m.is_leader desc,m.full_name) from public."AD_team_roster_v2"(team_cohort) m join public."AD_participants" a on a.id=m.participant_id where m.team_id=p_team),'[]'::jsonb));
end;
$$;
notify pgrst,'reload schema';
commit;
