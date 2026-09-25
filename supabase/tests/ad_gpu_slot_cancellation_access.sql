begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cohort uuid; team uuid; other_team uuid; booking uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_GPU_SLOT_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'GPU Slot Team') returning id into team;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Other GPU Team') returning id into other_team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student,'ad-gpu-slot-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (outsider,'ad-gpu-slot-other-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'GPU Slot Student','student'),(outsider,'GPU Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'GPU Slot Student','gpu-slot@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (cohort,outsider,'GPU Other Student','gpu-slot-other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select case when profile_id=student then team else other_team end,cohort,id,true from public."AD_participants" where cohort_id=cohort;
  perform set_config('ad.gpu.slot.actor',actor::text,true);
  perform set_config('ad.gpu.slot.student',student::text,true);
  perform set_config('ad.gpu.slot.outsider',outsider::text,true);
  perform set_config('ad.gpu.slot.cohort',cohort::text,true);
  perform set_config('ad.gpu.slot.team',team::text,true);
end $$;
set local role authenticated;
do $$
declare booking uuid;
begin
  booking:=public."AD_save_gpu_reservation"(current_setting('ad.gpu.slot.team')::uuid,date '2099-01-02',time '09:00',time '12:00',array[0,1]::smallint[],'Both GPUs');
  perform set_config('ad.gpu.slot.booking',booking::text,true);
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.slot.student'),true);end $$;
set local role authenticated;
do $$
declare original uuid:=current_setting('ad.gpu.slot.booking')::uuid; start_at timestamptz:=(date '2099-01-02'+time '10:00') at time zone 'Asia/Seoul'; end_at timestamptz:=(date '2099-01-02'+time '11:00') at time zone 'Asia/Seoul';
begin
  begin perform public."AD_cancel_gpu_reservation"(original);raise exception 'Whole booking cancellation still allowed';exception when insufficient_privilege then null;end;
  begin perform public."AD_cancel_gpu_reservation_slot"(original,2::smallint,date '2099-01-02',10::smallint);raise exception 'Unknown GPU allowed';exception when check_violation then null;end;
  begin perform public."AD_cancel_gpu_reservation_slot"(original,0::smallint,date '2099-01-02',20::smallint);raise exception 'Unbooked hour allowed';exception when check_violation then null;end;
  perform public."AD_cancel_gpu_reservation_slot"(original,0::smallint,date '2099-01-02',10::smallint);
  if (select count(*) from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02'))<>3 then raise exception 'Split did not preserve three segments';end if;
  if exists(select 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') r
    where 0=any(r.gpu_ids) and r.starts_at<end_at and r.ends_at>start_at) then raise exception 'Cancelled GPU hour remains';end if;
  if not exists(select 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') r
    where r.gpu_ids=array[1]::smallint[] and r.starts_at<end_at and r.ends_at>start_at) then raise exception 'Other GPU was cancelled';end if;
  if (select count(*) from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') r
    where r.gpu_ids=array[0]::smallint[])<>2 then raise exception 'Earlier or later GPU hour lost';end if;
  begin perform public."AD_cancel_gpu_reservation_slot"(original,1::smallint,date '2099-01-02',10::smallint);raise exception 'Stale original accepted';exception when check_violation then null;end;
end $$;
reset role;
do $$begin
  if not exists(select 1 from public."AD_gpu_reservations" where id=current_setting('ad.gpu.slot.booking')::uuid and status='cancelled' and cancelled_by=current_setting('ad.gpu.slot.student')::uuid) then
    raise exception 'Original cancellation audit missing';end if;
end $$;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.slot.outsider'),true);end $$;
set local role authenticated;
do $$
declare remaining uuid;
begin
  select id into strict remaining from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') where gpu_ids=array[1]::smallint[];
  begin perform public."AD_cancel_gpu_reservation_slot"(remaining,1::smallint,date '2099-01-02',10::smallint);raise exception 'Other team cancelled';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.gpu.slot.actor'),true);end $$;
set local role authenticated;
do $$
declare remaining uuid; before_count integer;
begin
  select id into strict remaining from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') where gpu_ids=array[1]::smallint[];
  perform public."AD_cancel_gpu_reservation_slot"(remaining,1::smallint,date '2099-01-02',10::smallint);
  select count(*) into before_count from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') r
    where 1=any(r.gpu_ids) and r.starts_at<((date '2099-01-02'+time '10:00') at time zone 'Asia/Seoul') and r.ends_at>((date '2099-01-02'+time '09:00') at time zone 'Asia/Seoul');
  if before_count<>1 then raise exception 'Professor slot cancellation erased earlier hour';end if;
  if exists(select 1 from public."AD_gpu_day_schedule_v2"(current_setting('ad.gpu.slot.cohort')::uuid,date '2099-01-02') r
    where 1=any(r.gpu_ids) and r.starts_at<((date '2099-01-02'+time '11:00') at time zone 'Asia/Seoul') and r.ends_at>((date '2099-01-02'+time '10:00') at time zone 'Asia/Seoul')) then raise exception 'Professor cancelled hour remains';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_cancel_gpu_reservation_slot"(current_setting('ad.gpu.slot.booking')::uuid,0::smallint,date '2099-01-02',9::smallint);raise exception 'Anonymous cancellation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD GPU per-hour per-device cancellation, preserved segments and roles passed; fixtures rolled back' as result;
rollback;
