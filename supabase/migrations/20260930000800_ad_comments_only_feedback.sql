begin;

-- 검토 상태를 제출 상태로 통합하고 교수 검토 RPC를 제거한다.
update public."AD_proposals" set status='submitted',review_note='',review_action=null,reviewed_at=null,reviewed_by=null,reviewer_name=null where status='reviewed';
update public."AD_reports" set status='submitted',review_note='',review_action=null,reviewed_at=null,reviewed_by=null,reviewer_name=null where status='reviewed';
drop function if exists public."AD_review_proposal"(uuid,timestamptz,text,text);
drop function if exists public."AD_review_report"(uuid,timestamptz,text,text);

create or replace function public."AD_save_proposal"(p_team uuid, p_version timestamptz, p_values jsonb, p_submit boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_proposals"%rowtype; actor_name text; field text; next_status text;
begin
  perform 1 from public."AD_teams" where id = p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists (
    select 1 from public."AD_profiles" where id = auth.uid() and role = 'student' and is_active and not must_change_password
  ) then raise exception 'Current student membership required' using errcode = '42501'; end if;
  select coalesce(nullif(display_name, ''), '학생') into actor_name from public."AD_profiles" where id = auth.uid();
  select * into previous from public."AD_proposals" where team_id = p_team;
  if previous.updated_at is distinct from p_version then raise exception 'Proposal changed' using errcode = '40001'; end if;
  if p_submit is null or p_values is null or jsonb_typeof(p_values) <> 'object' then raise exception 'Invalid fields' using errcode = '23514'; end if;
  if (select count(*) from jsonb_object_keys(p_values)) <> 8 then raise exception 'Unexpected fields' using errcode = '23514'; end if;
  foreach field in array array['title','overview','data_plan','methods','validation','service_plan','execution_plan','notion_url'] loop
    if jsonb_typeof(p_values->field) is distinct from 'string' then raise exception 'Missing text field' using errcode = '23514'; end if;
  end loop;
  next_status := case when p_submit then 'submitted' when previous.status='submitted' then 'submitted' else 'draft' end;
  insert into public."AD_proposals" (team_id,title,overview,data_plan,methods,validation,service_plan,execution_plan,notion_url,status,submitted_at,submitted_by,submitted_name,updated_by,updated_name)
    values (p_team,btrim(p_values->>'title'),p_values->>'overview',p_values->>'data_plan',p_values->>'methods',p_values->>'validation',p_values->>'service_plan',p_values->>'execution_plan',p_values->>'notion_url',next_status,
      case when p_submit then clock_timestamp() end,case when p_submit then auth.uid() end,case when p_submit then actor_name end,auth.uid(),actor_name)
  on conflict (team_id) do update set title=excluded.title,overview=excluded.overview,data_plan=excluded.data_plan,methods=excluded.methods,validation=excluded.validation,
    service_plan=excluded.service_plan,execution_plan=excluded.execution_plan,notion_url=excluded.notion_url,
    status=case when p_submit then 'submitted' when "AD_proposals".status='submitted' then 'submitted' else 'draft' end,
    submitted_at=case when p_submit then excluded.submitted_at else "AD_proposals".submitted_at end,
    submitted_by=case when p_submit then excluded.submitted_by else "AD_proposals".submitted_by end,
    submitted_name=case when p_submit then excluded.submitted_name else "AD_proposals".submitted_name end,
    updated_by=excluded.updated_by,updated_name=excluded.updated_name;
  return p_team;
end;
$$;
revoke all on function public."AD_save_proposal"(uuid,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public."AD_save_proposal"(uuid,timestamptz,jsonb,boolean) to authenticated;

create or replace function public."AD_program_monitoring"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then raise exception 'Program not found' using errcode='22023'; end if;
  with team_rows as (
    select t.id,t.name,t.topic,t.stage,p.status as proposal_status,p.title as proposal_title,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='daily' and r.status='submitted') as daily_submitted,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='weekly' and r.status='submitted') as weekly_submitted,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status='draft') as report_drafts,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status='submitted' and (btrim(r.issues)<>'' or btrim(r.support_request)<>'')) as reports_needing_attention,
      (select count(*) from public."AD_deliverables" d where d.team_id=t.id) as deliverable_count
    from public."AD_teams" t left join public."AD_proposals" p on p.team_id=t.id where t.cohort_id=p_cohort
  ), report_rounds as (
    select rounds.report_type,rounds.round_number,count(distinct r.team_id) filter(where r.status='submitted') as submitted_teams,max(r.report_date) as latest_date,
      coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name) filter(where r.team_id is null or r.status='draft'),'[]'::jsonb) as missing_teams
    from (select distinct report_type,round_number from public."AD_reports" r join public."AD_teams" t on t.id=r.team_id where t.cohort_id=p_cohort) rounds
    cross join public."AD_teams" t left join public."AD_reports" r on r.team_id=t.id and r.report_type=rounds.report_type and r.round_number=rounds.round_number
    where t.cohort_id=p_cohort group by rounds.report_type,rounds.round_number
  )
  select jsonb_build_object(
    'active_participants',(select count(*) from public."AD_participants" a where a.cohort_id=p_cohort and a.status='active'),
    'team_count',(select count(*) from team_rows),
    'proposal_submitted',(select count(*) from team_rows where proposal_status='submitted'),
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
