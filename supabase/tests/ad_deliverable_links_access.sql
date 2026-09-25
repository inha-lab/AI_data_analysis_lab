begin;
do $$
declare professor uuid;student uuid;cohort uuid;team_a uuid;team_b uuid;participant uuid;i int;suffix text:=gen_random_uuid()::text;
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_DELIVERABLE_TEST_'||suffix) returning id into cohort;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Deliverable A') returning id into team_a;
  insert into public."AD_teams"(cohort_id,name) values(cohort,'Deliverable B') returning id into team_b;
  for i in 1..3 loop
    student:=gen_random_uuid();
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(student,'ad-deliverable-'||i||'-'||suffix||'@example.invalid','{}'::jsonb,'{}'::jsonb);
    insert into public."AD_profiles"(id,display_name,role) values(student,'Deliverable Student '||i,'student');
    insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
      values(cohort,student,'Deliverable Student '||i,'deliverable'||i||'@example.invalid','Test','00'||i,'3','010-0000-0000','ai_development') returning id into participant;
    insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader) values(case when i=3 then team_b else team_a end,cohort,participant,i<>2);
    perform set_config('ad.deliverable_student'||i,student::text,true);
    perform set_config('ad.deliverable_participant'||i,participant::text,true);
  end loop;
  perform set_config('ad.deliverable_professor',professor::text,true);
  perform set_config('ad.deliverable_team_a',team_a::text,true);
  perform set_config('ad.deliverable_team_b',team_b::text,true);
  perform set_config('ad.deliverable_values','{"category":"analysis","title":"Result","description":"EDA","url":"https://example.org/result"}',true);
  perform set_config('request.jwt.claim.sub',current_setting('ad.deliverable_student1'),true);
end $$;
set local role authenticated;
do $$
declare team_a uuid:=current_setting('ad.deliverable_team_a')::uuid; item uuid; version timestamptz;
begin
  item:=public."AD_save_deliverable"(team_a,null,null,current_setting('ad.deliverable_values')::jsonb);
  perform set_config('ad.deliverable_item',item::text,true);
  if not exists(select 1 from public."AD_deliverables" where id=item and submitted_by=auth.uid() and title='Result') then raise exception 'Submission audit incorrect';end if;
  select updated_at into version from public."AD_deliverables" where id=item;
  perform set_config('ad.deliverable_version',version::text,true);
  begin perform public."AD_save_deliverable"(team_a,null,null,current_setting('ad.deliverable_values')::jsonb||'{"category":"bad"}'::jsonb);raise exception 'Invalid category';exception when check_violation then null;end;
  begin perform public."AD_save_deliverable"(team_a,null,null,current_setting('ad.deliverable_values')::jsonb||'{"url":"javascript:alert(1)"}'::jsonb);raise exception 'Unsafe URL';exception when check_violation then null;end;
  begin perform public."AD_save_deliverable"(team_a,null,null,current_setting('ad.deliverable_values')::jsonb||'{"status":"reviewed"}'::jsonb);raise exception 'Extra field';exception when check_violation then null;end;
  begin update public."AD_deliverables" set title='Direct' where id=item;raise exception 'Direct edit';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.deliverable_student2'),true);end $$;
set local role authenticated;
do $$
declare team_a uuid:=current_setting('ad.deliverable_team_a')::uuid; item uuid:=current_setting('ad.deliverable_item')::uuid; version timestamptz:=current_setting('ad.deliverable_version')::timestamptz;
begin
  if not exists(select 1 from public."AD_deliverables" where id=item) then raise exception 'Teammate cannot read';end if;
  perform public."AD_save_deliverable"(team_a,item,version,current_setting('ad.deliverable_values')::jsonb||'{"title":"Updated"}'::jsonb);
  if not exists(select 1 from public."AD_deliverables" where id=item and title='Updated' and submitted_by=auth.uid()) then raise exception 'Team edit incorrect';end if;
  begin perform public."AD_save_deliverable"(team_a,item,version,current_setting('ad.deliverable_values')::jsonb);raise exception 'Stale update';exception when serialization_failure then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.deliverable_student3'),true);end $$;
set local role authenticated;
do $$begin
  if exists(select 1 from public."AD_deliverables") then raise exception 'Other team read';end if;
  begin perform public."AD_delete_deliverable"(current_setting('ad.deliverable_team_a')::uuid,current_setting('ad.deliverable_item')::uuid,null);raise exception 'Other team delete';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.deliverable_professor'),true);end $$;
set local role authenticated;
do $$begin
  if not exists(select 1 from public."AD_deliverables" where id=current_setting('ad.deliverable_item')::uuid) then raise exception 'Professor read';end if;
  begin perform public."AD_save_deliverable"(current_setting('ad.deliverable_team_a')::uuid,null,null,current_setting('ad.deliverable_values')::jsonb);raise exception 'Professor edited';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',current_setting('ad.deliverable_student1'),true);end $$;
set local role authenticated;
do $$declare item uuid:=current_setting('ad.deliverable_item')::uuid;version timestamptz;begin
  select updated_at into version from public."AD_deliverables" where id=item;
  perform public."AD_delete_deliverable"(current_setting('ad.deliverable_team_a')::uuid,item,version);
  if exists(select 1 from public."AD_deliverables" where id=item) then raise exception 'Delete failed';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform 1 from public."AD_deliverables" limit 1;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'AD_deliverables link registration, team roles, version and deletion passed; fixtures rolled back' as result;
rollback;
