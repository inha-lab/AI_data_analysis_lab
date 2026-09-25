begin;
do $$
declare professor uuid;cohort uuid;team_a uuid;team_b uuid;team_c uuid;suffix text:=gen_random_uuid()::text;
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_PROGRAM_DELIVERABLE_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Alpha') returning id into team_a;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Beta') returning id into team_b;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Gamma') returning id into team_c;
  insert into public."AD_deliverables"(team_id,category,title,url,submitted_by,submitted_name,submitted_at)
    values(team_a,'analysis','Alpha old','https://example.org/a1',professor,'Test Professor','2026-09-20T00:00:00Z'),
      (team_a,'presentation','Alpha new','https://example.org/a2',professor,'Test Professor','2026-09-21T00:00:00Z'),
      (team_b,'demo','Beta latest','https://example.org/b1',professor,'Test Professor','2026-09-22T00:00:00Z');
  perform set_config('ad.program_deliverable_cohort',cohort::text,true);
  perform set_config('ad.program_deliverable_professor',professor::text,true);
end $$;
set local role authenticated;
do $$
declare data jsonb:=public."AD_program_deliverables"(current_setting('ad.program_deliverable_cohort')::uuid);
begin
  if (data->>'team_count')::int<>3 or (data->>'submitted_team_count')::int<>2 or (data->>'deliverable_count')::int<>3 then raise exception 'Summary totals incorrect: %',data;end if;
  if data #>> '{groups,0,name}'<>'Beta' or data #>> '{groups,1,name}'<>'Alpha' or data #>> '{groups,2,name}'<>'Gamma' then raise exception 'Team order incorrect: %',data;end if;
  if data #>> '{groups,1,items,0,title}'<>'Alpha new' or data #>> '{groups,1,items,1,title}'<>'Alpha old' then raise exception 'Item order incorrect: %',data;end if;
  if jsonb_array_length(data #> '{groups,2,items}')<>0 then raise exception 'Empty team incorrect';end if;
  begin perform public."AD_program_deliverables"(gen_random_uuid());raise exception 'Unknown program accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);end $$;
set local role authenticated;
do $$begin
  begin perform public."AD_program_deliverables"(current_setting('ad.program_deliverable_cohort')::uuid);raise exception 'Unprivileged read';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_program_deliverables"(current_setting('ad.program_deliverable_cohort')::uuid);raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_program_deliverables grouped totals, ordering and access passed; fixtures rolled back' as result;
rollback;
