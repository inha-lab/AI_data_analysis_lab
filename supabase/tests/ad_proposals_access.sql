begin;
-- Every Auth user, shared Auth-trigger effect and application fixture is rolled back.
do $$
declare actor uuid; c uuid; t1 uuid; t2 uuid; s uuid; p uuid; i integer; suffix text := gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('ad.proposal_actor', actor::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public."AD_cohorts"(name) values ('AD_PROPOSAL_TEST_' || suffix) returning id into c;
  insert into public."AD_teams"(cohort_id,name) values (c,'Proposal One') returning id into t1;
  insert into public."AD_teams"(cohort_id,name) values (c,'Proposal Other') returning id into t2;
  perform set_config('ad.proposal_cohort', c::text, true);
  perform set_config('ad.proposal_t1', t1::text, true); perform set_config('ad.proposal_t2', t2::text, true);
  for i in 1..3 loop
    s := gen_random_uuid();
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values (s,'ad-proposal-' || i || '-' || suffix || '@example.invalid','{}'::jsonb,'{}'::jsonb);
    insert into public."AD_profiles"(id,display_name,role) values (s,'Proposal Student ' || i,'student');
    insert into public."AD_participants"(cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group)
      values (c,s,'Proposal Student ' || i,'student' || i || '@example.invalid','Test','00' || i,'3','010-0000-0000','ai_development') returning id into p;
    insert into public."AD_team_members"(team_id,cohort_id,participant_id,is_leader) values (case when i=3 then t2 else t1 end,c,p,i<>2);
    perform set_config('ad.proposal_s' || i, s::text, true); perform set_config('ad.proposal_p' || i, p::text, true);
  end loop;
  perform set_config('ad.proposal_empty','{"title":"Project","overview":"","data_plan":"","methods":"","validation":"","service_plan":"","execution_plan":"","notion_url":""}',true);
  perform set_config('ad.proposal_full','{"title":"Project","overview":"Problem","data_plan":"Open data","methods":"Analysis","validation":"Baseline","service_plan":"Service","execution_plan":"Plan","notion_url":"https://notion.so/example"}',true);
  if not (select relrowsecurity from pg_class where oid='public."AD_proposals"'::regclass) then raise exception 'RLS disabled'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s1'),true);
end $$;
set local role authenticated;
do $$
declare t uuid:=current_setting('ad.proposal_t1')::uuid; v timestamptz;
begin
  perform public."AD_save_proposal"(t,null,current_setting('ad.proposal_empty')::jsonb,false);
  if not exists (select 1 from public."AD_proposals" where team_id=t and status='draft' and updated_by=auth.uid() and updated_name='Proposal Student 1' and submitted_at is null) then raise exception 'Draft audit incorrect'; end if;
  select updated_at into v from public."AD_proposals" where team_id=t;
  perform set_config('ad.proposal_version',v::text,true);
  begin perform public."AD_save_proposal"(t,null,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Concurrent first draft overwrite'; exception when serialization_failure then null; end;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_empty')::jsonb,true); raise exception 'Incomplete submission accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb || '{"status":"reviewed"}'::jsonb,false); raise exception 'Status injection accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb || '{"notion_url":"javascript:alert(1)"}'::jsonb,false); raise exception 'Unsafe link accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb || jsonb_build_object('overview',repeat('x',8001)),false); raise exception 'Oversized section accepted'; exception when check_violation then null; end;
  begin update public."AD_proposals" set status='reviewed' where team_id=t; raise exception 'Direct mutation permitted'; exception when insufficient_privilege then null; end;
  begin delete from public."AD_proposals" where team_id=t; raise exception 'Student deletion permitted'; exception when insufficient_privilege then null; end;
  begin perform public."AD_review_proposal"(t,v,'reviewed',''); raise exception 'Student review permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s2'),true); end $$;
set local role authenticated;
do $$
declare t uuid:=current_setting('ad.proposal_t1')::uuid; old_v timestamptz:=current_setting('ad.proposal_version')::timestamptz; v timestamptz;
begin
  perform public."AD_save_proposal"(t,old_v,current_setting('ad.proposal_full')::jsonb,false);
  begin perform public."AD_save_proposal"(t,old_v,current_setting('ad.proposal_empty')::jsonb,false); raise exception 'Stale teammate write permitted'; exception when serialization_failure then null; end;
  select updated_at into v from public."AD_proposals" where team_id=t;
  perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb,true);
  if not exists (select 1 from public."AD_proposals" where team_id=t and status='submitted' and submitted_by=auth.uid() and submitted_name='Proposal Student 2' and submitted_at is not null) then raise exception 'Submission audit incorrect'; end if;
  select updated_at into v from public."AD_proposals" where team_id=t;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Submitted document editable'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s3'),true); end $$;
set local role authenticated;
do $$ begin
  if exists (select 1 from public."AD_proposals") then raise exception 'Other team proposal leaked'; end if;
  begin perform public."AD_save_proposal"(current_setting('ad.proposal_t1')::uuid,null,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Other team write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_actor'),true); end $$;
set local role authenticated;
do $$
declare t uuid:=current_setting('ad.proposal_t1')::uuid; v timestamptz; stale timestamptz;
begin
  select updated_at into v from public."AD_proposals" where team_id=t;
  if v is null then raise exception 'Professor cannot read submission'; end if;
  begin perform public."AD_save_proposal"(t,v,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Professor overwrote student contents'; exception when insufficient_privilege then null; end;
  begin perform public."AD_review_proposal"(t,v,'returned',' '); raise exception 'Missing return reason accepted'; exception when check_violation then null; end;
  stale:=v;
  perform public."AD_review_proposal"(t,v,'reviewed','Good plan');
  if not exists (select 1 from public."AD_proposals" where team_id=t and status='reviewed' and reviewed_by=auth.uid() and review_note='Good plan' and reviewed_at is not null) then raise exception 'Review audit incorrect'; end if;
  begin perform public."AD_review_proposal"(t,stale,'returned','Stale feedback'); raise exception 'Stale review accepted'; exception when serialization_failure then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s1'),true); end $$;
set local role authenticated;
do $$ declare v timestamptz; begin
  select updated_at into v from public."AD_proposals" where team_id=current_setting('ad.proposal_t1')::uuid;
  begin perform public."AD_save_proposal"(current_setting('ad.proposal_t1')::uuid,v,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Reviewed document editable'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_actor'),true); end $$;
set local role authenticated;
do $$ declare v timestamptz; begin
  select updated_at into v from public."AD_proposals" where team_id=current_setting('ad.proposal_t1')::uuid;
  perform public."AD_review_proposal"(current_setting('ad.proposal_t1')::uuid,v,'returned','Add evaluation metrics');
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s1'),true); end $$;
set local role authenticated;
do $$ declare v timestamptz; begin
  select updated_at into v from public."AD_proposals" where team_id=current_setting('ad.proposal_t1')::uuid and status='draft';
  if v is null then raise exception 'Return did not reopen draft'; end if;
  perform public."AD_save_proposal"(current_setting('ad.proposal_t1')::uuid,v,current_setting('ad.proposal_full')::jsonb,true);
  if not exists (select 1 from public."AD_proposals" where team_id=current_setting('ad.proposal_t1')::uuid and status='submitted' and submitted_by=auth.uid() and review_note='Add evaluation metrics') then raise exception 'Resubmission audit or feedback lost'; end if;
end $$;
reset role;
update public."AD_profiles" set must_change_password=true where id=current_setting('ad.proposal_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Password gate bypassed'; end if; end $$;
reset role;
update public."AD_profiles" set must_change_password=false,is_active=false where id=current_setting('ad.proposal_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Inactive profile read'; end if; end $$;
reset role;
update public."AD_profiles" set is_active=true where id=current_setting('ad.proposal_s1')::uuid;
update public."AD_participants" set status='inactive' where id=current_setting('ad.proposal_p1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Inactive participation read'; end if; end $$;
reset role;
update public."AD_participants" set status='active' where id=current_setting('ad.proposal_p1')::uuid;
delete from public."AD_team_members" where participant_id=current_setting('ad.proposal_p1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Removed member access retained'; end if; end $$;
reset role;
update public."AD_profiles" set role='consultant' where id=current_setting('ad.proposal_s2')::uuid;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_s2'),true); end $$;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Consultant access'; end if; end $$;
reset role;
update public."AD_profiles" set role='researcher' where id=current_setting('ad.proposal_s2')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Researcher access'; end if; end $$;
reset role;
delete from public."AD_team_members" where team_id=current_setting('ad.proposal_t1')::uuid;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.proposal_actor'),true); end $$;
set local role authenticated;
do $$ declare v timestamptz; begin
  select updated_at into v from public."AD_teams" where id=current_setting('ad.proposal_t1')::uuid;
  begin perform public."AD_delete_empty_team"(current_setting('ad.proposal_t1')::uuid,v); raise exception 'Proposal-bearing team deleted'; exception when foreign_key_violation then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true); end $$;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_proposals") then raise exception 'Unregistered read'; end if; end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public."AD_proposals"; raise exception 'Anonymous read'; exception when insufficient_privilege then null; end;
  begin perform public."AD_save_proposal"(current_setting('ad.proposal_t1')::uuid,null,current_setting('ad.proposal_full')::jsonb,false); raise exception 'Anonymous save'; exception when insufficient_privilege then null; end;
  begin perform public."AD_review_proposal"(current_setting('ad.proposal_t1')::uuid,null,'reviewed',''); raise exception 'Anonymous review'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'AD_proposals collaborative drafts, submission, review/return, stale writes, audit, privacy and retention passed; fixtures rolled back' as result;
