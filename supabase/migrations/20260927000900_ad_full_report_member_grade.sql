begin;

create or replace function public."AD_team_full_report_v2"(p_team uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; team_cohort uuid;
begin
  base:=public."AD_team_full_report"(p_team);
  select cohort_id into team_cohort from public."AD_teams" where id=p_team;
  return jsonb_set(base,'{members}',coalesce((select jsonb_agg(jsonb_build_object(
    'full_name',m.full_name,'department',m.department,'grade',a.grade,'job_group',m.job_group,
    'is_leader',m.is_leader,'is_active',m.is_active,'role_title',m.role_title
  ) order by m.is_leader desc,m.full_name)
  from public."AD_team_roster_v2"(team_cohort) m
  join public."AD_participants" a on a.id=m.participant_id
  where m.team_id=p_team),'[]'::jsonb));
end;
$$;

revoke all on function public."AD_team_full_report_v2"(uuid) from public,anon,authenticated;
grant execute on function public."AD_team_full_report_v2"(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
