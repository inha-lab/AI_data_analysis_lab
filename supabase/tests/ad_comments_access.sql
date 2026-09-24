begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); cohort uuid; team uuid; report uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_COMMENT_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Comment Team') returning id into team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(student,'ad-comment-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Comment Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,student,'Comment Student','comment@example.invalid','Test','001','3','010-0000-0000','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select team,cohort,id,true from public."AD_participants" where cohort_id=cohort and profile_id=student;
  insert into public."AD_proposals"(team_id,title,updated_by,updated_name) values(team,'Test proposal',student,'Comment Student');
  insert into public."AD_reports"(team_id,report_type,round_number,report_date,title,updated_by,updated_name)
    values(team,'daily',1,current_date,'Test report',student,'Comment Student') returning id into report;
  perform set_config('ad.comment_actor',actor::text,true);
  perform set_config('ad.comment_student',student::text,true);
  perform set_config('ad.comment_team',team::text,true);
  perform set_config('ad.comment_report',report::text,true);
  if not(select relrowsecurity from pg_class where oid='public."AD_comments"'::regclass) then raise exception 'RLS disabled';end if;
end $$;
set local role authenticated;
do $$
declare team uuid:=current_setting('ad.comment_team')::uuid; report uuid:=current_setting('ad.comment_report')::uuid; comment_id uuid; version timestamptz;
begin
  comment_id:=public."AD_save_comment"(team,true,null,null,null,'  Proposal feedback  ');
  perform set_config('ad.comment_proposal',comment_id::text,true);
  if not exists(select 1 from public."AD_comments" where id=comment_id and body='Proposal feedback' and author_id=auth.uid() and proposal_team_id=team and report_id is null) then raise exception 'Proposal comment incorrect';end if;
  select updated_at into version from public."AD_comments" where id=comment_id;
  begin perform public."AD_save_comment"(team,true,null,comment_id,version,' ');raise exception 'Blank edit allowed';exception when check_violation then null;end;
  perform public."AD_save_comment"(team,true,null,comment_id,version,'Updated feedback');
  begin perform public."AD_delete_comment"(comment_id,version);raise exception 'Stale delete allowed';exception when serialization_failure then null;end;
  comment_id:=public."AD_save_comment"(team,false,report,null,null,'Report feedback');
  perform set_config('ad.comment_report_comment',comment_id::text,true);
  if not exists(select 1 from public."AD_comments" where id=comment_id and report_id=report and proposal_team_id is null) then raise exception 'Report comment incorrect';end if;
  begin perform public."AD_save_comment"(team,true,report,null,null,'Bad target');raise exception 'Mixed target allowed';exception when check_violation then null;end;
  begin perform public."AD_save_comment"(team,false,gen_random_uuid(),null,null,'Bad report');raise exception 'Unknown report allowed';exception when check_violation then null;end;
  begin update public."AD_comments" set body='Direct edit' where id=comment_id;raise exception 'Direct edit allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.comment_student'),true);end $$;
set local role authenticated;
do $$
begin
  if (select count(*) from public."AD_comments")<>2 then raise exception 'Team member cannot read comments';end if;
  begin perform public."AD_save_comment"(current_setting('ad.comment_team')::uuid,true,null,null,null,'Student comment');raise exception 'Student posted';exception when insufficient_privilege then null;end;
  begin perform public."AD_delete_comment"(current_setting('ad.comment_proposal')::uuid,(select updated_at from public."AD_comments" where id=current_setting('ad.comment_proposal')::uuid));raise exception 'Student deleted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.comment_actor'),true);end $$;
set local role authenticated;
do $$
declare comment_id uuid:=current_setting('ad.comment_report_comment')::uuid; version timestamptz;
begin
  select updated_at into version from public."AD_comments" where id=comment_id;
  perform public."AD_delete_comment"(comment_id,version);
  if exists(select 1 from public."AD_comments" where id=comment_id) then raise exception 'Delete failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_comments" limit 1;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_comments proposal/report, owner edits, roles and deletion passed; fixtures rolled back' as result;
rollback;
