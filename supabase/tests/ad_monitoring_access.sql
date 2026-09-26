begin;
do $$
declare professor uuid;student uuid:=gen_random_uuid();cohort uuid;team_a uuid;team_b uuid;suffix text:=gen_random_uuid()::text;
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_MONITOR_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name,stage) values(cohort,'Alpha','planning') returning id into team_a;
  insert into public."AD_teams"(cohort_id,name,stage) values(cohort,'Beta','implementation') returning id into team_b;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(student,'ad-monitor-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Monitor Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,student,'Monitor Student','monitor@example.invalid','Test','001','3','010-0000-0000','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select team_a,cohort,id,true from public."AD_participants" where cohort_id=cohort and profile_id=student;
  insert into public."AD_proposals"(team_id,title,status,submitted_at,submitted_by,submitted_name,updated_by,updated_name,overview,data_plan,methods,validation,service_plan,execution_plan)
    values(team_a,'Proposal','submitted',now(),student,'Monitor Student',student,'Monitor Student','a','b','c','d','e','f');
  insert into public."AD_reports"(team_id,report_type,round_number,report_date,title,status,submitted_at,submitted_by,submitted_name,updated_by,updated_name,progress_summary,completed_work,next_plan,issues)
    values(team_a,'daily',1,current_date,'Daily','submitted',now(),student,'Monitor Student',student,'Monitor Student','a','b','c','Delay');
  insert into public."AD_reports"(team_id,report_type,round_number,report_date,title,updated_by,updated_name)
    values(team_b,'daily',1,current_date,'Draft',student,'Monitor Student');
  insert into public."AD_deliverables"(team_id,category,title,url,submitted_by,submitted_name) values
    (team_a,'github','Repository','https://example.com/repository',student,'Monitor Student'),
    (team_a,'analysis','Analysis','https://example.com/analysis',student,'Monitor Student');
  perform set_config('ad.monitor_professor',professor::text,true);
  perform set_config('ad.monitor_student',student::text,true);
  perform set_config('ad.monitor_cohort',cohort::text,true);
end $$;
set local role authenticated;
do $$
declare result jsonb:=public."AD_program_monitoring"(current_setting('ad.monitor_cohort')::uuid);
begin
  if (result->>'active_participants')::int<>1 or (result->>'team_count')::int<>2 or (result->>'proposal_submitted')::int<>1 then raise exception 'Summary incorrect: %',result;end if;
  if (result->>'deliverable_submitted_teams')::int<>1 or (result->>'deliverable_count')::int<>2 then raise exception 'Deliverable summary incorrect: %',result;end if;
  if (result->>'reports_awaiting_review')::int<>1 then raise exception 'Review queue total incorrect: %',result;end if;
  if jsonb_array_length(result->'teams')<>2 or jsonb_array_length(result->'rounds')<>1 then raise exception 'Team/round count incorrect: %',result;end if;
  if (result #>> '{rounds,0,submitted_teams}')::int<>1 or jsonb_array_length(result #> '{rounds,0,missing_teams}')<>1 or result #>> '{rounds,0,missing_teams,0,name}'<>'Beta' then raise exception 'Missing team calculation incorrect: %',result;end if;
  if (result #>> '{teams,0,reports_needing_attention}')::int<>1 then raise exception 'Issue count incorrect: %',result;end if;
  if (result #>> '{teams,0,deliverable_count}')::int<>2 or (result #>> '{teams,1,deliverable_count}')::int<>0 then raise exception 'Team deliverable count incorrect: %',result;end if;
  if (result #>> '{teams,0,reports_awaiting_review}')::int<>1 or (result #>> '{teams,1,reports_awaiting_review}')::int<>0 then raise exception 'Team review queue incorrect: %',result;end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.monitor_student'),true);end $$;
set local role authenticated;
do $$begin
  begin perform public."AD_program_monitoring"(current_setting('ad.monitor_cohort')::uuid);raise exception 'Student accessed monitoring';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_program_monitoring"(current_setting('ad.monitor_cohort')::uuid);raise exception 'Anonymous accessed monitoring';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_program_monitoring totals, missing teams and access passed; fixtures rolled back' as result;
rollback;
