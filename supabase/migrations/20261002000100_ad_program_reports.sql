begin;

create function public."AD_program_reports"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then
    raise exception 'Manager permission required' using errcode='42501';
  end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then
    raise exception 'Program not found' using errcode='22023';
  end if;

  with groups as (
    select t.id,t.name,t.topic,t.stage,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='daily') as daily_count,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.report_type='weekly') as weekly_count,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status='draft') as draft_count,
      (select count(*) from public."AD_reports" r where r.team_id=t.id and r.status='submitted') as submitted_count,
      (select max(r.updated_at) from public."AD_reports" r where r.team_id=t.id) as latest_at,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id',r.id,'report_type',r.report_type,'round_number',r.round_number,
        'report_date',r.report_date,'title',r.title,'status',r.status,
        'has_attention',(btrim(r.issues)<>'' or btrim(r.support_request)<>''),
        'updated_at',r.updated_at,'updated_name',r.updated_name,
        'submitted_at',r.submitted_at,'submitted_name',r.submitted_name
      ) order by r.report_date desc,r.updated_at desc,r.id) from public."AD_reports" r where r.team_id=t.id),'[]'::jsonb) as reports
    from public."AD_teams" t where t.cohort_id=p_cohort
  )
  select jsonb_build_object(
    'team_count',(select count(*) from groups),
    'reporting_team_count',(select count(*) from groups where daily_count+weekly_count>0),
    'daily_count',(select coalesce(sum(daily_count),0) from groups),
    'weekly_count',(select coalesce(sum(weekly_count),0) from groups),
    'groups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'topic',topic,'stage',stage,
      'daily_count',daily_count,'weekly_count',weekly_count,
      'draft_count',draft_count,'submitted_count',submitted_count,
      'latest_at',latest_at,'reports',reports
    ) order by latest_at desc nulls last,name,id) from groups),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public."AD_program_reports"(uuid) from public,anon,authenticated;
grant execute on function public."AD_program_reports"(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
