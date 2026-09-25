begin;
do $$
declare professor uuid; leader_user uuid:=gen_random_uuid(); member_user uuid:=gen_random_uuid(); outsider_user uuid:=gen_random_uuid(); cohort uuid; leader_id uuid; member_id uuid; outsider_id uuid; team uuid; other_team uuid; suffix text:=gen_random_uuid()::text;
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_ROLE_EDIT_'||suffix) returning id into cohort;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
    (leader_user,'ad-role-leader-'||suffix||'@example.invalid','{}','{}'),
    (member_user,'ad-role-member-'||suffix||'@example.invalid','{}','{}'),
    (outsider_user,'ad-role-outsider-'||suffix||'@example.invalid','{}','{}');
  insert into public."AD_profiles"(id,display_name,role) values
    (leader_user,'Role Leader','student'),(member_user,'Role Member','student'),(outsider_user,'Role Outsider','student');
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,leader_user,'Role Leader','leader@example.invalid','Test','001','3','010-0000-0000','ai_development') returning id into leader_id;
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,member_user,'Role Member','member@example.invalid','Test','002','3','010-0000-0001','ai_development') returning id into member_id;
  insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort,outsider_user,'Role Outsider','outsider@example.invalid','Test','003','3','010-0000-0002','ai_development') returning id into outsider_id;
  team:=public."AD_save_team_v2"(cohort,jsonb_build_object('name','Main Team','topic','','stage','planning','notion_url','','github_url','','demo_url',''),array[leader_id,member_id],leader_id,null,null,'{}'::jsonb);
  other_team:=public."AD_save_team_v2"(cohort,jsonb_build_object('name','Other Team','topic','','stage','planning','notion_url','','github_url','','demo_url',''),array[outsider_id],outsider_id,null,null,'{}'::jsonb);
  perform public."AD_update_team_member_role"(team,member_id,'교수 지정');
  perform set_config('ad.role.edit.leader_user',leader_user::text,true);
  perform set_config('ad.role.edit.member_user',member_user::text,true);
  perform set_config('ad.role.edit.outsider_user',outsider_user::text,true);
  perform set_config('ad.role.edit.leader_id',leader_id::text,true);
  perform set_config('ad.role.edit.member_id',member_id::text,true);
  perform set_config('ad.role.edit.outsider_id',outsider_id::text,true);
  perform set_config('ad.role.edit.cohort',cohort::text,true);
  perform set_config('ad.role.edit.team',team::text,true);
  perform set_config('ad.role.edit.other_team',other_team::text,true);
end $$;
set local role authenticated;
do $$
declare team uuid:=current_setting('ad.role.edit.team')::uuid; cohort uuid:=current_setting('ad.role.edit.cohort')::uuid; leader_id uuid:=current_setting('ad.role.edit.leader_id')::uuid; member_id uuid:=current_setting('ad.role.edit.member_id')::uuid; outsider_id uuid:=current_setting('ad.role.edit.outsider_id')::uuid;
begin
  perform set_config('request.jwt.claim.sub',current_setting('ad.role.edit.leader_user'),true);
  if (public."AD_team_workspace"(cohort)->>'my_participant_id')<>leader_id::text then raise exception 'Own participant ID missing';end if;
  perform public."AD_update_team_member_role"(team,member_id,'팀장 지정');
  perform public."AD_update_team_member_role"(team,leader_id,'팀장 본인');
  begin perform public."AD_update_team_member_role"(team,member_id,repeat('가',81));raise exception 'Long role accepted';exception when check_violation then null;end;
  begin perform public."AD_update_team_member_role"(team,outsider_id,'외부인');raise exception 'Outsider target accepted';exception when check_violation then null;end;
end $$;
do $$
declare team uuid:=current_setting('ad.role.edit.team')::uuid; member_id uuid:=current_setting('ad.role.edit.member_id')::uuid; leader_id uuid:=current_setting('ad.role.edit.leader_id')::uuid; other_team uuid:=current_setting('ad.role.edit.other_team')::uuid; outsider_id uuid:=current_setting('ad.role.edit.outsider_id')::uuid;
begin
  perform set_config('request.jwt.claim.sub',current_setting('ad.role.edit.member_user'),true);
  perform public."AD_update_team_member_role"(team,member_id,'본인 지정');
  begin perform public."AD_update_team_member_role"(team,leader_id,'무단 변경');raise exception 'Member changed leader';exception when insufficient_privilege then null;end;
  begin perform public."AD_update_team_member_role"(other_team,outsider_id,'무단 변경');raise exception 'Member changed another team';exception when insufficient_privilege then null;end;
end $$;
do $$
declare team uuid:=current_setting('ad.role.edit.team')::uuid; member_id uuid:=current_setting('ad.role.edit.member_id')::uuid;
begin
  perform set_config('request.jwt.claim.sub',current_setting('ad.role.edit.outsider_user'),true);
  begin perform public."AD_update_team_member_role"(team,member_id,'무단 변경');raise exception 'Outsider changed team';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$
declare team uuid:=current_setting('ad.role.edit.team')::uuid; member_id uuid:=current_setting('ad.role.edit.member_id')::uuid;
begin
  if (select role_title from public."AD_team_members" where team_id=team and participant_id=member_id)<>'본인 지정' then raise exception 'Member role not saved';end if;
end $$;
set local role anon;
do $$
begin
  begin perform public."AD_update_team_member_role"(current_setting('ad.role.edit.team')::uuid,current_setting('ad.role.edit.member_id')::uuid,'익명');raise exception 'Anon changed role';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Professor, leader, self, outsider, validation and anonymous role permissions passed; fixtures rolled back' as result;
rollback;
