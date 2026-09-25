begin;
create or replace function public."AD_program_monitoring"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then raise exception 'Program not found' using errcode='22023'; end if;
  with team_rows as (
    select t.id,t.name,t.topic,t.stage,
      p.status as proposal_status,p.title as proposal_title,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='daily' and r.status in ('submitted','reviewed')) as daily_submitted,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='weekly' and r.status in ('submitted','reviewed')) as weekly_submitted,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status='draft') as report_drafts,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status in ('submitted','reviewed') and (btrim(r.issues)<>'' or btrim(r.support_request)<>'')) as reports_needing_attention,
      (select count(*) from public."AD_deliverables" d where d.team_id=t.id) as deliverable_count
    from public."AD_teams" t left join public."AD_proposals" p on p.team_id=t.id where t.cohort_id=p_cohort
  ), report_rounds as (
    select rounds.report_type,rounds.round_number,
      count(distinct r.team_id) filter(where r.status in ('submitted','reviewed')) as submitted_teams,
      max(r.report_date) as latest_date,
      coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name) filter(where r.team_id is null or r.status='draft'),'[]'::jsonb) as missing_teams
    from (select distinct report_type,round_number from public."AD_reports" r join public."AD_teams" t on t.id=r.team_id where t.cohort_id=p_cohort) rounds
    cross join public."AD_teams" t
    left join public."AD_reports" r on r.team_id=t.id and r.report_type=rounds.report_type and r.round_number=rounds.round_number
    where t.cohort_id=p_cohort
    group by rounds.report_type,rounds.round_number
  )
  select jsonb_build_object(
    'active_participants',(select count(*) from public."AD_participants" a where a.cohort_id=p_cohort and a.status='active'),
    'team_count',(select count(*) from team_rows),
    'proposal_submitted',(select count(*) from team_rows where proposal_status in ('submitted','reviewed')),
    'deliverable_submitted_teams',(select count(*) from team_rows where deliverable_count>0),
    'deliverable_count',(select coalesce(sum(deliverable_count),0) from team_rows),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'topic',topic,'stage',stage,'proposal_status',proposal_status,'proposal_title',proposal_title,'daily_submitted',daily_submitted,'weekly_submitted',weekly_submitted,'report_drafts',report_drafts,'reports_needing_attention',reports_needing_attention,'deliverable_count',deliverable_count) order by name) from team_rows),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(jsonb_build_object('type',report_type,'round',round_number,'submitted_teams',submitted_teams,'latest_date',latest_date,'missing_teams',missing_teams) order by report_type,round_number desc) from report_rounds),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
notify pgrst,'reload schema';
commit;
