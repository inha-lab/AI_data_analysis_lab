begin;
do $$
declare actor uuid; student1 uuid:=gen_random_uuid(); student2 uuid:=gen_random_uuid(); cohort uuid; team1 uuid; team2 uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_GPU_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'GPU Team 1') returning id into team1;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'GPU Team 2') returning id into team2;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student1,'ad-gpu-one-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (student2,'ad-gpu-two-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student1,'GPU Student 1','student'),(student2,'GPU Student 2','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student1,'GPU Student 1','gpu1@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (cohort,student2,'GPU Student 2','gpu2@example.invalid','Test','002','3','010-0000-0001','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select case when profile_id=student1 then team1 else team2 end,cohort,id,true from public."AD_participants" where cohort_id=cohort;
  perform set_config('ad.gpu.actor',actor::text,true);
  perform set_config('ad.gpu.student1',student1::text,true);
  perform set_config('ad.gpu.student2',student2::text,true);
  perform set_config('ad.gpu.cohort',cohort::text,true);
  perform set_config('ad.gpu.team1',team1::text,true);
  perform set_config('ad.gpu.team2',team2::text,true);
end $$;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.student1'),true);end $$;
set local role authenticated;
do $$
declare reservation uuid;
begin
  reservation:=public."AD_save_gpu_reservation"(current_setting('ad.gpu.team1')::uuid,current_date,'23:00','01:00',array[0]::smallint[],'Analysis');
  perform set_config('ad.gpu.reservation1',reservation::text,true);
  if not exists(select 1 from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date) where id=reservation and can_cancel and ends_at-starts_at=interval '2 hours') then raise exception 'Overnight reservation incorrect';end if;
  if not exists(select 1 from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date+1) where id=reservation) then raise exception 'Overnight next-day view missing';end if;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.team2')::uuid,current_date,'23:30','00:30',array[1]::smallint[],'Wrong team');raise exception 'Other team booked';exception when insufficient_privilege then null;end;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.team1')::uuid,current_date,'23:30','00:30',array[0,1]::smallint[],'Conflict');raise exception 'Overlap allowed';exception when exclusion_violation then null;end;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.team1')::uuid,current_date,'09:00','10:00',array[1,0]::smallint[],'Invalid order');raise exception 'Invalid GPU list allowed';exception when check_violation then null;end;
  begin perform 1 from public."AD_gpu_reservations";raise exception 'Direct read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.student2'),true);end $$;
set local role authenticated;
do $$
declare reservation uuid;
begin
  if not exists(select 1 from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date) where id=current_setting('ad.gpu.reservation1')::uuid and not can_cancel) then raise exception 'Other team view or cancel flag incorrect';end if;
  begin perform public."AD_cancel_gpu_reservation"(current_setting('ad.gpu.reservation1')::uuid);raise exception 'Other team cancelled';exception when insufficient_privilege then null;end;
  reservation:=public."AD_save_gpu_reservation"(current_setting('ad.gpu.team2')::uuid,current_date,'23:30','00:30',array[1]::smallint[],'GPU 1');
  perform set_config('ad.gpu.reservation2',reservation::text,true);
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.team2')::uuid,current_date,'23:30','00:30',array[0,1]::smallint[],'Both conflict');raise exception 'Partial GPU reservation allowed';exception when exclusion_violation then null;end;
  if (select count(*) from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date))<>2 then raise exception 'Failed both reservation created partial row';end if;
  perform public."AD_cancel_gpu_reservation"(reservation);
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.student1'),true);end $$;
set local role authenticated;
do $$
declare reservation uuid;
begin
  perform public."AD_cancel_gpu_reservation"(current_setting('ad.gpu.reservation1')::uuid);
  reservation:=public."AD_save_gpu_reservation"(current_setting('ad.gpu.team1')::uuid,current_date,'23:00','01:00',array[0,1]::smallint[],'Both GPUs');
  if not exists(select 1 from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date) where id=reservation and gpu_ids=array[0,1]::smallint[]) then raise exception 'Both GPU booking failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.actor'),true);end $$;
set local role authenticated;
do $$begin
  if (select count(*) from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date))<>1 then raise exception 'Professor schedule incorrect';end if;
  begin perform public."AD_save_gpu_reservation"(current_setting('ad.gpu.team1')::uuid,current_date,'09:00','10:00',array[0]::smallint[],'Professor');raise exception 'Professor booked';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$
declare other_cohort uuid; other_team uuid; suffix text:=gen_random_uuid()::text;
begin
  insert into public."AD_cohorts"(name) values('AD_GPU_OTHER_PROGRAM_'||suffix) returning id into other_cohort;
  insert into public."AD_teams"(cohort_id,name) values(other_cohort,'Private GPU Team') returning id into other_team;
  insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by)
    values(other_cohort,other_team,array[0]::smallint[],(current_date+time '12:00') at time zone 'Asia/Seoul',(current_date+time '13:00') at time zone 'Asia/Seoul','Private purpose',current_setting('ad.gpu.actor')::uuid);
end $$;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.student1'),true);end $$;
set local role authenticated;
do $$begin
  if not exists(select 1 from public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date)
    where program_name='다른 프로그램' and team_name='다른 프로그램' and team_id is null and purpose='예약 중' and not can_cancel)
    then raise exception 'Cross-program availability or redaction failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_gpu_day_schedule"(current_setting('ad.gpu.cohort')::uuid,current_date);raise exception 'Anonymous schedule';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD GPU reservations overnight, atomic overlap, cancellation and roles passed; fixtures rolled back' as result;
rollback;
