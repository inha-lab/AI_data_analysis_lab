begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cohort uuid; team uuid; other_team uuid; deliverable uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_DELIVERABLE_COMMENT_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Comment Team') returning id into team;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Other Team') returning id into other_team;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student,'ad-delivery-comment-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (outsider,'ad-delivery-outsider-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Comment Student','student'),(outsider,'Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'Comment Student','comment@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (cohort,outsider,'Other Student','other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader)
    select case when profile_id=student then team else other_team end,cohort,id,true from public."AD_participants" where cohort_id=cohort;
  insert into public."AD_deliverables"(team_id,category,title,url,submitted_by,submitted_name)
    values(team,'other','Test material','https://example.com',student,'Comment Student') returning id into deliverable;
  perform set_config('ad.dc.actor',actor::text,true);
  perform set_config('ad.dc.student',student::text,true);
  perform set_config('ad.dc.outsider',outsider::text,true);
  perform set_config('ad.dc.team',team::text,true);
  perform set_config('ad.dc.other_team',other_team::text,true);
  perform set_config('ad.dc.deliverable',deliverable::text,true);
end $$;
set local role authenticated;
do $$
declare team uuid:=current_setting('ad.dc.team')::uuid; item uuid:=current_setting('ad.dc.deliverable')::uuid; comment_id uuid; version timestamptz;
begin
  comment_id:=public."AD_save_deliverable_comment"(team,item,null,null,'  Material feedback  ');
  perform set_config('ad.dc.comment',comment_id::text,true);
  if not exists(select 1 from public."AD_comments" where id=comment_id and team_id=team and deliverable_id=item and proposal_team_id is null and report_id is null and body='Material feedback' and author_id=auth.uid()) then raise exception 'Deliverable comment incorrect';end if;
  select updated_at into version from public."AD_comments" where id=comment_id;
  begin perform public."AD_save_deliverable_comment"(team,item,comment_id,version,' ');raise exception 'Blank comment allowed';exception when check_violation then null;end;
  begin perform public."AD_save_deliverable_comment"(current_setting('ad.dc.other_team')::uuid,item,null,null,'Wrong team');raise exception 'Wrong team allowed';exception when check_violation then null;end;
  perform public."AD_save_deliverable_comment"(team,item,comment_id,version,'Updated feedback');
  begin perform public."AD_save_deliverable_comment"(team,item,comment_id,version,'Stale');raise exception 'Stale edit allowed';exception when serialization_failure then null;end;
  begin update public."AD_comments" set body='Direct edit' where id=comment_id;raise exception 'Direct edit allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.dc.student'),true);end $$;
set local role authenticated;
do $$
declare item uuid:=current_setting('ad.dc.deliverable')::uuid; version timestamptz;
begin
  if (select count(*) from public."AD_comments")<>1 then raise exception 'Team member cannot read comment';end if;
  begin perform public."AD_save_deliverable_comment"(current_setting('ad.dc.team')::uuid,item,null,null,'Student');raise exception 'Student posted';exception when insufficient_privilege then null;end;
  begin perform public."AD_delete_comment"(current_setting('ad.dc.comment')::uuid,(select updated_at from public."AD_comments" where id=current_setting('ad.dc.comment')::uuid));raise exception 'Student deleted';exception when insufficient_privilege then null;end;
  select updated_at into version from public."AD_deliverables" where id=item;
  begin perform public."AD_delete_deliverable"(current_setting('ad.dc.team')::uuid,item,version);raise exception 'Commented deliverable deleted';exception when foreign_key_violation then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.dc.outsider'),true);end $$;
set local role authenticated;
do $$begin if exists(select 1 from public."AD_comments" where deliverable_id=current_setting('ad.dc.deliverable')::uuid) then raise exception 'Other team read comment';end if;end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.dc.actor'),true);end $$;
set local role authenticated;
do $$
declare comment_id uuid:=current_setting('ad.dc.comment')::uuid;
begin
  perform public."AD_delete_comment"(comment_id,(select updated_at from public."AD_comments" where id=comment_id));
  if exists(select 1 from public."AD_comments" where id=comment_id) then raise exception 'Comment deletion failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_comments" limit 1;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
  begin perform public."AD_save_deliverable_comment"(null,null,null,null,'Anonymous');raise exception 'Anonymous RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_deliverable comments roles, ownership, versions and deletion guard passed; fixtures rolled back' as result;
rollback;
