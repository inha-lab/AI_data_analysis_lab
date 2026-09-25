begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); cohort uuid; participant uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_TEAM_ROLE_TEST_'||suffix) returning id into cohort;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(student,'ad-team-role-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Role Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,student,'Role Student','role@example.invalid','Test','001','3','010-0000-0000','ai_development') returning id into participant;
  perform set_config('ad.team.role.actor',actor::text,true);
  perform set_config('ad.team.role.student',student::text,true);
  perform set_config('ad.team.role.cohort',cohort::text,true);
  perform set_config('ad.team.role.participant',participant::text,true);
end $$;
set local role authenticated;
do $$
declare cohort uuid:=current_setting('ad.team.role.cohort')::uuid; participant uuid:=current_setting('ad.team.role.participant')::uuid; team uuid; version timestamptz;
  team_values jsonb:=jsonb_build_object('name','Role Team','topic','Test','stage','planning','notion_url','','github_url','','demo_url','');
begin
  begin perform public."AD_save_team"(cohort,team_values,array[participant],participant,null,null);raise exception 'Old save function still callable';exception when insufficient_privilege then null;end;
  team:=public."AD_save_team_v2"(cohort,team_values,array[participant],participant,null,null,jsonb_build_object(participant::text,'모델 개발'));
  perform set_config('ad.team.role.team',team::text,true);
  if (select role_title from public."AD_team_roster_v2"(cohort) where participant_id=participant)<>'모델 개발' then raise exception 'Role not saved';end if;
  select updated_at into version from public."AD_teams" where id=team;
  begin perform public."AD_save_team_v2"(cohort,team_values,array[participant],participant,team,version,jsonb_build_object(participant::text,repeat('가',81)));raise exception 'Long role accepted';exception when check_violation then null;end;
  if (select role_title from public."AD_team_roster_v2"(cohort) where participant_id=participant)<>'모델 개발' then raise exception 'Failed update changed role';end if;
  perform public."AD_save_team_v2"(cohort,team_values,array[participant],participant,team,version,jsonb_build_object(participant::text,'데이터 분석'));
  if (public."AD_team_full_report_v2"(team)->'members'->0->>'role_title')<>'데이터 분석' then raise exception 'Updated full report role missing';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.team.role.student'),true);end $$;
set local role authenticated;
do $$
declare cohort uuid:=current_setting('ad.team.role.cohort')::uuid; participant uuid:=current_setting('ad.team.role.participant')::uuid; team uuid:=current_setting('ad.team.role.team')::uuid;
  team_values jsonb:=jsonb_build_object('name','Role Team','topic','Test','stage','planning','notion_url','','github_url','','demo_url','');
begin
  if (public."AD_team_workspace"(cohort)->'roster'->0->>'role_title')<>'데이터 분석' then raise exception 'Student workspace role missing';end if;
  begin perform public."AD_save_team_v2"(cohort,team_values,array[participant],participant,team,null,jsonb_build_object(participant::text,'역할 변경'));raise exception 'Student changed role';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD team member role save, read, validation and access passed; fixtures rolled back' as result;
rollback;
