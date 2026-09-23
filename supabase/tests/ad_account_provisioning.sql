begin;
-- Test users, the shared Auth trigger's rows, and app fixtures are all rolled back.
do $$
declare professor_id uuid; fresh_id uuid := gen_random_uuid(); existing_id uuid := gen_random_uuid(); cohort_a uuid; cohort_b uuid; new_participant uuid; existing_participant uuid; suffix text := gen_random_uuid()::text;
begin
  select id into strict professor_id from public."AD_profiles" where role = 'professor' and is_active limit 1;
  perform set_config('request.jwt.claim.sub', professor_id::text, true);
  perform set_config('ad.test_professor', professor_id::text, true);
  insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
    values (fresh_id, 'ad-new-' || suffix || '@example.invalid', '{"ad_lab_created":true}'::jsonb, '{}'::jsonb),
      (existing_id, 'ad-existing-' || suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb);
  insert into public."AD_cohorts"(name) values ('AD_TEST_A_' || suffix) returning id into cohort_a;
  insert into public."AD_cohorts"(name) values ('AD_TEST_B_' || suffix) returning id into cohort_b;
  insert into public."AD_participants"(cohort_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort_a,'New Test','ad-new-' || suffix || '@example.invalid','Test','001','3','010-0000-0000','ai_development') returning id into new_participant;
  insert into public."AD_participants"(cohort_id,full_name,email,department,student_number,grade,phone,job_group)
    values(cohort_b,'Existing Test','ad-existing-' || suffix || '@example.invalid','Test','002','3','010-0000-0000','ai_development') returning id into existing_participant;
  perform set_config('ad.test_fresh', fresh_id::text, true);
  perform set_config('ad.test_existing', existing_id::text, true);
  perform set_config('ad.test_new_participant', new_participant::text, true);
  perform set_config('ad.test_existing_participant', existing_participant::text, true);
  perform set_config('ad.test_cohort', cohort_a::text, true);
end $$;

set local role service_role;
do $$
declare item public."AD_participants"%rowtype; linked_id uuid; original_version timestamptz;
begin
  select * into item from public."AD_participants" where id=current_setting('ad.test_new_participant')::uuid;
  original_version := item.updated_at;
  if public."AD_find_auth_user"(item.email) <> current_setting('ad.test_fresh')::uuid then raise exception 'Auth lookup failed'; end if;
  linked_id := public."AD_link_participant_account"(item.id,current_setting('ad.test_fresh')::uuid,current_setting('ad.test_professor')::uuid,item.email,item.updated_at);
  if not exists (select 1 from public."AD_profiles" where id=linked_id and role='student' and must_change_password) then raise exception 'New account not gated'; end if;
  begin
    perform public."AD_link_participant_account"(item.id,linked_id,current_setting('ad.test_professor')::uuid,item.email,original_version);
    raise exception 'Stale participant accepted';
  exception when serialization_failure then null; end;
  select * into item from public."AD_participants" where id=current_setting('ad.test_existing_participant')::uuid;
  linked_id := public."AD_link_participant_account"(item.id,current_setting('ad.test_existing')::uuid,current_setting('ad.test_professor')::uuid,item.email,item.updated_at);
  if not exists (select 1 from public."AD_profiles" where id=linked_id and not must_change_password) then raise exception 'Existing account forced to change password'; end if;
  select * into item from public."AD_participants" where id=item.id;
  begin
    perform public."AD_link_participant_account"(item.id,linked_id,current_setting('ad.test_fresh')::uuid,item.email,item.updated_at);
    raise exception 'Nonprofessor actor accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  begin
    perform public."AD_find_auth_user"('nobody@example.invalid');
    raise exception 'Browser can enumerate Auth accounts';
  exception when insufficient_privilege then null; end;
  begin
    perform public."AD_link_participant_account"(gen_random_uuid(),gen_random_uuid(),auth.uid(),'nobody@example.invalid',now());
    raise exception 'Browser can call account linker';
  exception when insufficient_privilege then null; end;
  begin
    update public."AD_participants" set email='changed@example.invalid' where id=current_setting('ad.test_new_participant')::uuid;
    raise exception 'Linked email modified';
  exception when check_violation then null; end;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claim.sub',current_setting('ad.test_fresh'),true); end $$;
set local role authenticated;
do $$ begin
  if not exists (select 1 from public."AD_profiles" where id=auth.uid() and must_change_password) then raise exception 'Own setup profile not visible'; end if;
  if exists (select 1 from public."AD_participants") or exists (select 1 from public."AD_cohorts") then raise exception 'Data visible before password change'; end if;
  begin
    update public."AD_profiles" set must_change_password=false where id=auth.uid();
    raise exception 'Student can clear password requirement';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Simulate the trusted completion step; never change a real user's password.
update public."AD_profiles" set must_change_password=false where id=current_setting('ad.test_fresh')::uuid;
set local role authenticated;
do $$ begin
  if (select count(*) from public."AD_participants") <> 1 then raise exception 'Student must see only own participation'; end if;
  if (select count(*) from public."AD_cohorts") <> 1 then raise exception 'Student must see only own cohort'; end if;
  if not exists (select 1 from public."AD_cohorts" where id=current_setting('ad.test_cohort')::uuid) then raise exception 'Own cohort missing'; end if;
  update public."AD_participants" set full_name='Forbidden' where id=current_setting('ad.test_new_participant')::uuid;
  if found then raise exception 'Student can modify participant'; end if;
end $$;
reset role;
update public."AD_participants" set status='inactive' where id=current_setting('ad.test_new_participant')::uuid;
set local role authenticated;
do $$ begin
  if exists (select 1 from public."AD_participants") or exists (select 1 from public."AD_cohorts") then raise exception 'Inactive membership still readable'; end if;
end $$;
reset role;
rollback;
select 'Account linking, password gate, self-only access and deactivation checks passed' as result;
