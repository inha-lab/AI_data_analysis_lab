begin;
do $$
declare actor uuid; student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cohort uuid; other_cohort uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public."AD_cohorts"(name) values('AD_ANNOUNCEMENT_TEST_'||suffix) returning id into cohort;
  insert into public."AD_cohorts"(name) values('AD_ANNOUNCEMENT_OTHER_'||suffix) returning id into other_cohort;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (student,'ad-announcement-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb),
    (outsider,'ad-announcement-other-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
  insert into public."AD_profiles"(id,display_name,role) values(student,'Announcement Student','student'),(outsider,'Other Student','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group) values
    (cohort,student,'Announcement Student','announcement@example.invalid','Test','001','3','010-0000-0000','ai_development'),
    (other_cohort,outsider,'Other Student','other@example.invalid','Test','002','3','010-0000-0001','ai_development');
  perform set_config('ad.announcement.actor',actor::text,true);
  perform set_config('ad.announcement.student',student::text,true);
  perform set_config('ad.announcement.outsider',outsider::text,true);
  perform set_config('ad.announcement.cohort',cohort::text,true);
  perform set_config('ad.announcement.other_cohort',other_cohort::text,true);
end $$;
set local role authenticated;
do $$
declare cohort uuid:=current_setting('ad.announcement.cohort')::uuid; ann_id uuid; version timestamptz;
begin
  ann_id:=public."AD_save_announcement"(cohort,null,null,'  Important  ','  Notice body  ',true);
  perform set_config('ad.announcement.id',ann_id::text,true);
  if not exists(select 1 from public."AD_announcements" a where a.id=ann_id and a.title='Important' and a.body='Notice body' and a.is_pinned and a.author_id=auth.uid()) then raise exception 'Announcement insert failed';end if;
  select updated_at into version from public."AD_announcements" where id=ann_id;
  begin perform public."AD_save_announcement"(cohort,ann_id,version,' ','body',true);raise exception 'Blank title allowed';exception when check_violation then null;end;
  begin perform public."AD_save_announcement"(current_setting('ad.announcement.other_cohort')::uuid,ann_id,version,'Moved','body',false);raise exception 'Cross-cohort edit allowed';exception when check_violation then null;end;
  perform public."AD_save_announcement"(cohort,ann_id,version,'Updated','body',false);
  begin perform public."AD_delete_announcement"(cohort,ann_id,version);raise exception 'Stale delete allowed';exception when serialization_failure then null;end;
  begin update public."AD_announcements" set title='Direct edit' where id=ann_id;raise exception 'Direct edit allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.announcement.student'),true);end $$;
set local role authenticated;
do $$begin
  if (select count(*) from public."AD_announcements" where cohort_id=current_setting('ad.announcement.cohort')::uuid)<>1 then raise exception 'Student read failed';end if;
  begin perform public."AD_save_announcement"(current_setting('ad.announcement.cohort')::uuid,null,null,'Student','body',false);raise exception 'Student posted';exception when insufficient_privilege then null;end;
  begin perform public."AD_delete_announcement"(current_setting('ad.announcement.cohort')::uuid,current_setting('ad.announcement.id')::uuid,null);raise exception 'Student deleted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.announcement.outsider'),true);end $$;
set local role authenticated;
do $$begin if exists(select 1 from public."AD_announcements" where id=current_setting('ad.announcement.id')::uuid) then raise exception 'Other program read';end if;end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.announcement.actor'),true);end $$;
set local role authenticated;
do $$begin
  perform public."AD_delete_announcement"(current_setting('ad.announcement.cohort')::uuid,current_setting('ad.announcement.id')::uuid,(select updated_at from public."AD_announcements" where id=current_setting('ad.announcement.id')::uuid));
  if exists(select 1 from public."AD_announcements" where id=current_setting('ad.announcement.id')::uuid) then raise exception 'Delete failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_announcements" limit 1;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
  begin perform public."AD_save_announcement"(null,null,null,'Title','Body',false);raise exception 'Anonymous RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_announcements permissions, program scope, version conflict and deletion passed; fixtures rolled back' as result;
rollback;
