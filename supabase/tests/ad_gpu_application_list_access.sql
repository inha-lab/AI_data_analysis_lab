begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); other_student uuid:=gen_random_uuid(); cohort uuid; team uuid; other_team uuid; booking uuid; application uuid; created timestamptz; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_GPU_APPLICATION_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Application Team') returning id into team;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Other Team') returning id into other_team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student,'ad-gpu-app-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (other_student,'ad-gpu-app-other-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'GPU Student','student'),(other_student,'Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'GPU Student','gpu-app@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (cohort,other_student,'Other Student','gpu-app-other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select case when profile_id=student then team else other_team end,cohort,id,true from public."AD_participants" where cohort_id=cohort;
  insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by)
    values(cohort,team,array[0,1]::smallint[],timestamp '2098-01-02 09:00' at time zone 'Asia/Seoul',timestamp '2098-01-02 12:00' at time zone 'Asia/Seoul','Application test',student)
    returning id,application_id,created_at into booking,application,created;
  update public."AD_gpu_reservations" set status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=student where id=booking;
  insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by,created_at,application_id) values
    (cohort,team,array[1]::smallint[],timestamp '2098-01-02 09:00' at time zone 'Asia/Seoul',timestamp '2098-01-02 12:00' at time zone 'Asia/Seoul','Application test',student,created,application),
    (cohort,team,array[0]::smallint[],timestamp '2098-01-02 09:00' at time zone 'Asia/Seoul',timestamp '2098-01-02 10:00' at time zone 'Asia/Seoul','Application test',student,created,application),
    (cohort,team,array[0]::smallint[],timestamp '2098-01-02 11:00' at time zone 'Asia/Seoul',timestamp '2098-01-02 12:00' at time zone 'Asia/Seoul','Application test',student,created,application);
  perform set_config('ad.gpu.app.id',application::text,true);
  perform set_config('ad.gpu.app.cohort',cohort::text,true);
  perform set_config('ad.gpu.app.student',student::text,true);
  perform set_config('ad.gpu.app.other',other_student::text,true);
end $$;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.app.other'),true);end $$;
set local role authenticated;
do $$begin
  if (select count(*) from public."AD_gpu_application_list"(current_setting('ad.gpu.app.cohort')::uuid) where application_id=current_setting('ad.gpu.app.id')::uuid)<>1 then raise exception 'Split application not grouped';end if;
  begin perform public."AD_cancel_gpu_application"(current_setting('ad.gpu.app.id')::uuid);raise exception 'Other team cancelled application';exception when insufficient_privilege then null;end;
  begin perform public."AD_cancel_gpu_reservation_slot"(gen_random_uuid(),0::smallint,date '2098-01-02',9::smallint);raise exception 'Old slot cancellation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.app.student'),true);end $$;
set local role authenticated;
do $$declare app record;begin
  select * into strict app from public."AD_gpu_application_list"(current_setting('ad.gpu.app.cohort')::uuid) where application_id=current_setting('ad.gpu.app.id')::uuid;
  if jsonb_array_length(app.segments)<>3 or not app.can_cancel then raise exception 'Application segments or permission incorrect';end if;
  perform public."AD_cancel_gpu_application"(app.application_id);
  if exists(select 1 from public."AD_gpu_application_list"(current_setting('ad.gpu.app.cohort')::uuid) where application_id=app.application_id) then raise exception 'Cancelled application still listed';end if;
end $$;
reset role;
do $$begin
  if exists(select 1 from public."AD_gpu_reservations" where application_id=current_setting('ad.gpu.app.id')::uuid and status='active') then raise exception 'Active segment remains';end if;
  if (select count(*) from public."AD_gpu_reservations" where application_id=current_setting('ad.gpu.app.id')::uuid and status='cancelled')<>4 then raise exception 'Cancellation audit incomplete';end if;
end $$;
select 'AD GPU application grouping, whole cancellation and access passed; fixtures rolled back' as result;
rollback;
