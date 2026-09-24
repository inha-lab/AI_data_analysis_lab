begin;
create function public."AD_team_full_report"(p_team uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; team_cohort uuid;
begin
  select cohort_id into team_cohort from public."AD_teams" where id=p_team;
  if team_cohort is null or not public."AD_can_read_team"(p_team) then
    raise exception 'Team report permission required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'program_name',c.name,
    'team',jsonb_build_object('id',t.id,'cohort_id',t.cohort_id,'name',t.name,'topic',t.topic,'stage',t.stage,'notion_url',t.notion_url,'github_url',t.github_url,'demo_url',t.demo_url),
    'members',coalesce((select jsonb_agg(jsonb_build_object('full_name',m.full_name,'department',m.department,'job_group',m.job_group,'is_leader',m.is_leader,'is_active',m.is_active) order by m.is_leader desc,m.full_name) from public."AD_team_roster"(team_cohort) m where m.team_id=p_team),'[]'::jsonb),
    'proposal',(select jsonb_build_object('title',p.title,'status',p.status,'overview',p.overview,'data_plan',p.data_plan,'methods',p.methods,'validation',p.validation,'service_plan',p.service_plan,'execution_plan',p.execution_plan,'notion_url',p.notion_url,'updated_at',p.updated_at,'updated_name',p.updated_name,'submitted_at',p.submitted_at,'submitted_name',p.submitted_name,'review_action',p.review_action,'review_note',p.review_note,'reviewed_at',p.reviewed_at,'reviewer_name',p.reviewer_name) from public."AD_proposals" p where p.team_id=p_team),
    'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'report_type',r.report_type,'round_number',r.round_number,'report_date',r.report_date,'title',r.title,'status',r.status,'progress_summary',r.progress_summary,'completed_work',r.completed_work,'next_plan',r.next_plan,'issues',r.issues,'support_request',r.support_request,'updated_at',r.updated_at,'updated_name',r.updated_name,'submitted_at',r.submitted_at,'submitted_name',r.submitted_name,'review_action',r.review_action,'review_note',r.review_note,'reviewed_at',r.reviewed_at,'reviewer_name',r.reviewer_name) order by r.report_type,r.round_number,r.report_date) from public."AD_reports" r where r.team_id=p_team),'[]'::jsonb)
  ) into result
  from public."AD_teams" t join public."AD_cohorts" c on c.id=t.cohort_id where t.id=p_team;
  return result;
end;
$$;
revoke all on function public."AD_team_full_report"(uuid) from public,anon,authenticated;
grant execute on function public."AD_team_full_report"(uuid) to authenticated;
commit;
