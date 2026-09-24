begin;
do $$
declare professor uuid;student uuid:=gen_random_uuid();cohort uuid;team uuid;other_team uuid;suffix text:=gen_random_uuid()::text;
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_FULL_REPORT_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name,topic) values(cohort,'Report Team','Project topic') returning id into team;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Other Team') returning id into other_team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(student,'ad-full-report-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Report Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,student,'Report Student','full-report@example.invalid','Test','001','3','010-0000-0000','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select team,cohort,id,true from public."AD_participants" where cohort_id=cohort and profile_id=student;
  insert into public."AD_proposals"(team_id,title,updated_by,updated_name) values(team,'Draft proposal',student,'Report Student');
  insert into public."AD_reports"(team_id,report_type,round_number,report_date,title,updated_by,updated_name)
    values(team,'weekly',1,current_date,'Weekly report',student,'Report Student');
  perform set_config('ad.full_report_professor',professor::text,true);
  perform set_config('ad.full_report_student',student::text,true);
  perform set_config('ad.full_report_team',team::text,true);
  perform set_config('ad.full_report_other',other_team::text,true);
end $$;
set local role authenticated;
do $$
declare data jsonb:=public."AD_team_full_report"(current_setting('ad.full_report_team')::uuid);
begin
  if data->>'program_name' is null or data #>> '{team,name}'<>'Report Team' or jsonb_array_length(data->'members')<>1 or jsonb_array_length(data->'reports')<>1 or data #>> '{proposal,title}'<>'Draft proposal' then raise exception 'Full report projection incorrect: %',data;end if;
  if data #>> '{members,0,full_name}'<>'Report Student' or data #>> '{reports,0,title}'<>'Weekly report' then raise exception 'Full report details missing: %',data;end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.full_report_student'),true);end $$;
set local role authenticated;
do $$begin
  if public."AD_team_full_report"(current_setting('ad.full_report_team')::uuid) #>> '{team,name}'<>'Report Team' then raise exception 'Member cannot read';end if;
  begin perform public."AD_team_full_report"(current_setting('ad.full_report_other')::uuid);raise exception 'Other team read';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public."AD_participants" set status='completed' where profile_id=current_setting('ad.full_report_student')::uuid;
set local role authenticated;
do $$begin
  begin perform public."AD_team_full_report"(current_setting('ad.full_report_team')::uuid);raise exception 'Completed member read';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_team_full_report"(current_setting('ad.full_report_team')::uuid);raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_team_full_report projection and membership restrictions passed; fixtures rolled back' as result;
rollback;
