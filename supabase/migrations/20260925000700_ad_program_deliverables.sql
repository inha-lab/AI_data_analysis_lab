begin;
create function public."AD_program_deliverables"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501';end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then raise exception 'Program not found' using errcode='22023';end if;
  with groups as (
    select t.id,t.name,t.stage,
      (select count(*) from public."AD_deliverables" d where d.team_id=t.id) as item_count,
      (select max(d.submitted_at) from public."AD_deliverables" d where d.team_id=t.id) as latest_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'category',d.category,'title',d.title,'description',d.description,'url',d.url,'submitted_name',d.submitted_name,'submitted_at',d.submitted_at) order by d.submitted_at desc,d.id desc) from public."AD_deliverables" d where d.team_id=t.id),'[]'::jsonb) as items
    from public."AD_teams" t where t.cohort_id=p_cohort
  )
  select jsonb_build_object(
    'team_count',(select count(*) from groups),
    'submitted_team_count',(select count(*) from groups where item_count>0),
    'deliverable_count',(select coalesce(sum(item_count),0) from groups),
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stage',stage,'item_count',item_count,'latest_at',latest_at,'items',items) order by latest_at desc nulls last,name,id) from groups),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public."AD_program_deliverables"(uuid) from public,anon,authenticated;
grant execute on function public."AD_program_deliverables"(uuid) to authenticated;
commit;
