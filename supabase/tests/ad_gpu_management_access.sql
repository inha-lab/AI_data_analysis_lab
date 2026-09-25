begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cohort uuid; other_cohort uuid; team uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_GPU_MANAGEMENT_'||suffix) returning id into cohort;
  insert into public."AD_cohorts"(name) values('AD_GPU_MANAGEMENT_OTHER_'||suffix) returning id into other_cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'GPU Management Team') returning id into team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student,'ad-gpu-manage-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (outsider,'ad-gpu-manage-other-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'GPU Student','student'),(outsider,'Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'GPU Student','gpu@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (other_cohort,outsider,'Other Student','other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select team,cohort,id,true from public."AD_participants" where cohort_id=cohort and profile_id=student;
  perform set_config('ad.gpu.management.actor',actor::text,true);
  perform set_config('ad.gpu.management.student',student::text,true);
  perform set_config('ad.gpu.management.outsider',outsider::text,true);
  perform set_config('ad.gpu.management.cohort',cohort::text,true);
  perform set_config('ad.gpu.management.team',team::text,true);
end $$;
set local role authenticated;
do $$
declare booking uuid;
begin
  booking:=public."AD_save_gpu_reservation"(current_setting('ad.gpu.management.team')::uuid,date '2099-01-01',time '09:00',time '10:00',array[0,1]::smallint[],'Professor booking');
  perform set_config('ad.gpu.management.booking',booking::text,true);
  if not exists(select 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.management.cohort')::uuid,date '2099-01-01')
    where id=booking and requester_name is not null and gpu_ids=array[0,1]::smallint[]) then raise exception 'Professor booking or requester projection failed';end if;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.management.team')::uuid,date '2099-01-01',time '11:30',time '12:00',array[0]::smallint[],'Partial hour');raise exception 'Non-hour booking allowed';exception when check_violation then null;end;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.management.team')::uuid,date '2099-01-01',time '09:00',time '10:00',array[0]::smallint[],'Conflict');raise exception 'Professor overlap allowed';exception when exclusion_violation then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.management.student'),true);end $$;
set local role authenticated;
do $$begin
  if not exists(select 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.management.cohort')::uuid,date '2099-01-01')
    where id=current_setting('ad.gpu.management.booking')::uuid and requester_name is null and can_cancel) then raise exception 'Student requester privacy failed';end if;
  perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.management.team')::uuid,date '2099-01-01',time '10:00',time '11:00',array[0]::smallint[],'Adjacent booking');
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.management.outsider'),true);end $$;
set local role authenticated;
do $$begin
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.management.team')::uuid,date '2099-01-01',time '12:00',time '13:00',array[0]::smallint[],'Other student');raise exception 'Other student booked';exception when insufficient_privilege then null;end;
  begin perform 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.management.cohort')::uuid,date '2099-01-01');raise exception 'Other program schedule allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.management.cohort')::uuid,date '2099-01-01');raise exception 'Anonymous schedule allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD GPU professor booking, hourly input, requester privacy and roles passed; fixtures rolled back' as result;
rollback;
