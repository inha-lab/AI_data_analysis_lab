begin;
-- Users, shared Auth-trigger rows and AD fixtures are rolled back together.
do $$
declare actor uuid; c uuid; t1 uuid; t2 uuid; s uuid; p uuid; i integer; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('ad.report_actor',actor::text,true);perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values ('AD_REPORT_TEST_'||suffix) returning id into c;
  insert into public."AD_teams"(cohort_id,name) values(c,'Report One') returning id into t1;
  insert into public."AD_teams"(cohort_id,name) values(c,'Report Other') returning id into t2;
  perform set_config('ad.report_c',c::text,true);perform set_config('ad.report_t1',t1::text,true);perform set_config('ad.report_t2',t2::text,true);
  for i in 1..3 loop
    s:=gen_random_uuid();
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(s,'ad-report-'||i||'-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
    insert into public."AD_profiles"(id,display_name,role) values(s,'Report Student '||i,'student');
    insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
      values(c,s,'Report Student '||i,'report'||i||'@example.invalid','Test','00'||i,'3','010-0000-0000','ai_development') returning id into p;
    insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader) values(case when i=3 then t2 else t1 end,c,p,i<>2);
    perform set_config('ad.report_s'||i,s::text,true);perform set_config('ad.report_p'||i,p::text,true);
  end loop;
  perform set_config('ad.report_empty','{"report_type":"daily","round_number":"1","report_date":"2026-09-25","title":"Daily 1","progress_summary":"","completed_work":"","next_plan":"","issues":"","support_request":""}',true);
  perform set_config('ad.report_full','{"report_type":"daily","round_number":"1","report_date":"2026-09-25","title":"Daily 1","progress_summary":"Progress","completed_work":"Done","next_plan":"Next","issues":"","support_request":""}',true);
  if not(select relrowsecurity from pg_class where oid='public."AD_reports"'::regclass) then raise exception 'RLS disabled'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('ad.report_s1'),true);
end $$;
set local role authenticated;
do $$
declare t uuid:=current_setting('ad.report_t1')::uuid; r uuid; v timestamptz;
begin
  r:=public."AD_save_report"(t,null,null,current_setting('ad.report_empty')::jsonb,false);
  perform set_config('ad.report_r',r::text,true);
  if not exists(select 1 from public."AD_reports" where id=r and status='draft' and updated_by=auth.uid() and updated_name='Report Student 1' and submitted_at is null) then raise exception 'Draft audit incorrect'; end if;
  select updated_at into v from public."AD_reports" where id=r;
  perform set_config('ad.report_version',v::text,true);
  begin perform public."AD_save_report"(t,r,v,current_setting('ad.report_empty')::jsonb,true);raise exception 'Incomplete report submitted';exception when check_violation then null;end;
  begin perform public."AD_save_report"(t,r,v,current_setting('ad.report_full')::jsonb||'{"status":"reviewed"}'::jsonb,false);raise exception 'Status injection';exception when check_violation then null;end;
  begin perform public."AD_save_report"(t,r,v,current_setting('ad.report_full')::jsonb||'{"report_date":"2026-02-29"}'::jsonb,false);raise exception 'Impossible date accepted';exception when datetime_field_overflow then null;end;
  begin update public."AD_reports" set status='reviewed' where id=r;raise exception 'Direct mutation permitted';exception when insufficient_privilege then null;end;
  begin delete from public."AD_reports" where id=r;raise exception 'Direct deletion permitted';exception when insufficient_privilege then null;end;
  begin perform public."AD_review_report"(r,v,'reviewed','');raise exception 'Student reviewed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_s2'),true);end $$;
set local role authenticated;
do $$
declare t uuid:=current_setting('ad.report_t1')::uuid; r uuid:=current_setting('ad.report_r')::uuid; old_v timestamptz:=current_setting('ad.report_version')::timestamptz; v timestamptz; r2 uuid;
begin
  perform public."AD_save_report"(t,r,old_v,current_setting('ad.report_full')::jsonb,false);
  begin perform public."AD_save_report"(t,r,old_v,current_setting('ad.report_full')::jsonb,false);raise exception 'Stale teammate update';exception when serialization_failure then null;end;
  select updated_at into v from public."AD_reports" where id=r;
  perform public."AD_save_report"(t,r,v,current_setting('ad.report_full')::jsonb,true);
  if not exists(select 1 from public."AD_reports" where id=r and status='submitted' and submitted_by=auth.uid() and submitted_name='Report Student 2') then raise exception 'Submission audit incorrect';end if;
  select updated_at into v from public."AD_reports" where id=r;
  perform public."AD_save_report"(t,r,v,current_setting('ad.report_full')::jsonb||'{"progress_summary":"Edited after submit"}'::jsonb,false);
  if not exists(select 1 from public."AD_reports" where id=r and status='submitted' and progress_summary='Edited after submit' and submitted_by=auth.uid()) then raise exception 'Save did not preserve submission';end if;
  select updated_at into v from public."AD_reports" where id=r;
  perform public."AD_save_report"(t,r,v,current_setting('ad.report_full')::jsonb,true);
  if not exists(select 1 from public."AD_reports" where id=r and status='submitted' and progress_summary='Progress' and submitted_by=auth.uid()) then raise exception 'Resubmission failed';end if;
  begin perform public."AD_save_report"(t,null,null,current_setting('ad.report_full')::jsonb,false);raise exception 'Duplicate round accepted';exception when unique_violation then null;end;
  r2:=public."AD_save_report"(t,null,null,current_setting('ad.report_full')::jsonb||'{"report_type":"weekly"}'::jsonb,false);
  if not exists(select 1 from public."AD_reports" where id=r2 and report_type='weekly' and round_number=1) then raise exception 'Weekly round not independent';end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_s3'),true);end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public."AD_reports") then raise exception 'Other team read';end if;
  begin perform public."AD_save_report"(current_setting('ad.report_t1')::uuid,current_setting('ad.report_r')::uuid,null,current_setting('ad.report_full')::jsonb,false);raise exception 'Other team write';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_actor'),true);end $$;
set local role authenticated;
do $$ declare r uuid:=current_setting('ad.report_r')::uuid; v timestamptz;stale timestamptz;begin
  select updated_at into v from public."AD_reports" where id=r;
  if v is null then raise exception 'Professor read failed';end if;
  begin perform public."AD_save_report"(current_setting('ad.report_t1')::uuid,r,v,current_setting('ad.report_full')::jsonb,false);raise exception 'Professor edited student report';exception when insufficient_privilege then null;end;
  begin perform public."AD_review_report"(r,v,'returned',' ');raise exception 'Empty return reason';exception when check_violation then null;end;
  stale:=v;perform public."AD_review_report"(r,v,'reviewed','Well done');
  if not exists(select 1 from public."AD_reports" where id=r and status='reviewed' and reviewed_by=auth.uid() and review_note='Well done') then raise exception 'Review audit incorrect';end if;
  begin perform public."AD_review_report"(r,stale,'returned','Stale');raise exception 'Stale review accepted';exception when serialization_failure then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_s1'),true);end $$;
set local role authenticated;
do $$ declare v timestamptz;begin
  select updated_at into v from public."AD_reports" where id=current_setting('ad.report_r')::uuid;
  begin perform public."AD_save_report"(current_setting('ad.report_t1')::uuid,current_setting('ad.report_r')::uuid,v,current_setting('ad.report_full')::jsonb,false);raise exception 'Reviewed report editable';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_actor'),true);end $$;
set local role authenticated;
do $$ declare v timestamptz;begin
  select updated_at into v from public."AD_reports" where id=current_setting('ad.report_r')::uuid;
  perform public."AD_review_report"(current_setting('ad.report_r')::uuid,v,'returned','Please expand results');
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_s1'),true);end $$;
set local role authenticated;
do $$ declare v timestamptz;begin
  select updated_at into v from public."AD_reports" where id=current_setting('ad.report_r')::uuid and status='draft';
  if v is null then raise exception 'Return did not reopen report';end if;
  perform public."AD_save_report"(current_setting('ad.report_t1')::uuid,current_setting('ad.report_r')::uuid,v,current_setting('ad.report_full')::jsonb,true);
  if not exists(select 1 from public."AD_reports" where id=current_setting('ad.report_r')::uuid and submitted_by=auth.uid() and review_note='Please expand results') then raise exception 'Resubmission/feedback lost';end if;
end $$;
reset role;
update public."AD_profiles" set must_change_password=true where id=current_setting('ad.report_s1')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public."AD_reports") then raise exception 'Password gate bypass';end if;end $$;
reset role;
update public."AD_profiles" set must_change_password=false,is_active=false where id=current_setting('ad.report_s1')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public."AD_reports") then raise exception 'Inactive profile read';end if;end $$;
reset role;
update public."AD_profiles" set is_active=true where id=current_setting('ad.report_s1')::uuid;
update public."AD_participants" set status='inactive' where id=current_setting('ad.report_p1')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public."AD_reports") then raise exception 'Inactive participation read';end if;end $$;
reset role;
update public."AD_participants" set status='active' where id=current_setting('ad.report_p1')::uuid;
delete from public."AD_team_members" where participant_id=current_setting('ad.report_p1')::uuid;
set local role authenticated;
do $$ begin if exists(select 1 from public."AD_reports") then raise exception 'Removed member read';end if;end $$;
reset role;
delete from public."AD_team_members" where team_id=current_setting('ad.report_t1')::uuid;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.report_actor'),true);end $$;
set local role authenticated;
do $$ declare v timestamptz;begin
  select updated_at into v from public."AD_teams" where id=current_setting('ad.report_t1')::uuid;
  begin perform public."AD_delete_empty_team"(current_setting('ad.report_t1')::uuid,v);raise exception 'Report-bearing team deleted';exception when foreign_key_violation then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);end $$;
set local role authenticated;
do $$ begin if exists(select 1 from public."AD_reports") then raise exception 'Unregistered read';end if;end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public."AD_reports";raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
  begin perform public."AD_save_report"(current_setting('ad.report_t1')::uuid,null,null,current_setting('ad.report_full')::jsonb,false);raise exception 'Anonymous save';exception when insufficient_privilege then null;end;
  begin perform public."AD_review_report"(current_setting('ad.report_r')::uuid,null,'reviewed','');raise exception 'Anonymous review';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'AD_reports daily/weekly drafts, state-preserving edits, resubmission, review/return, roles and retention passed; fixtures rolled back' as result;
