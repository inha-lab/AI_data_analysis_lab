begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cohort uuid; other_cohort uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_LOGIN_TEST_'||suffix) returning id into cohort;
  insert into public."AD_cohorts"(name) values('AD_LOGIN_OTHER_'||suffix) returning id into other_cohort;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,last_sign_in_at) values
    (student,'ad-login-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb,clock_timestamp()),
    (outsider,'ad-login-other-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb,clock_timestamp()-interval '1 day');
  insert into public."AD_profiles"(id,display_name,role) values(student,'Login Student','student'),(outsider,'Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'Login Student','login@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (other_cohort,outsider,'Other Student','other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  perform set_config('ad.login.actor',actor::text,true);
  perform set_config('ad.login.student',student::text,true);
  perform set_config('ad.login.outsider',outsider::text,true);
  perform set_config('ad.login.cohort',cohort::text,true);
  perform set_config('ad.login.other_cohort',other_cohort::text,true);
end $$;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.login.student'),true);end $$;
set local role authenticated;
do $$begin
  perform public."AD_record_login_activity"('mobile','Safari');
  perform public."AD_record_login_activity"('desktop','Chrome');
  begin perform public."AD_record_login_activity"('invalid','Chrome');raise exception 'Invalid device allowed';exception when check_violation then null;end;
  begin perform 1 from public."AD_login_activities";raise exception 'Student direct read allowed';exception when insufficient_privilege then null;end;
  begin perform 1 from public."AD_program_login_activity"(current_setting('ad.login.cohort')::uuid,null);raise exception 'Student list allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.login.outsider'),true);end $$;
set local role authenticated;
do $$begin
  begin perform public."AD_record_login_activity"('desktop','Chrome');raise exception 'Old login recorded';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.login.actor'),true);end $$;
set local role authenticated;
do $$
declare cohort uuid:=current_setting('ad.login.cohort')::uuid; other_cohort uuid:=current_setting('ad.login.other_cohort')::uuid;
begin
  if (select count(*) from public."AD_program_login_activity"(cohort,null))<>1 then raise exception 'Login dedup or program list failed';end if;
  if exists(select 1 from public."AD_program_login_activity"(other_cohort,null)) then raise exception 'Other program leaked';end if;
  if not exists(select 1 from public."AD_program_login_activity"(cohort,null) where full_name='Login Student' and device_type='mobile' and browser_name='Safari' and last_sign_in_at=signed_in_at) then raise exception 'Login projection incorrect';end if;
  if exists(select 1 from public."AD_program_login_activity"(cohort,clock_timestamp()+interval '1 minute')) then raise exception 'Since filter failed';end if;
  begin perform public."AD_record_login_activity"('desktop','Chrome');raise exception 'Professor recorded student login';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_login_activities";raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
  begin perform public."AD_program_login_activity"(null,null);raise exception 'Anonymous list';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_login_activity recent login, dedup, program scope and roles passed; fixtures rolled back' as result;
rollback;
