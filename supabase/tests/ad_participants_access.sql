begin;
-- All test fixtures and temporary role changes are rolled back.
do $$
declare professor_id uuid;
begin
  select id into strict professor_id from public."AD_profiles" where role = 'professor' and is_active limit 1;
  perform set_config('request.jwt.claim.sub', professor_id::text, true);
  perform set_config('ad.test_professor', professor_id::text, true);
  perform set_config('ad.test_name', 'AD_TEST_' || gen_random_uuid()::text, true);
  if not (select relrowsecurity from pg_class where oid = 'public."AD_participants"'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
set local role authenticated;
do $$
declare cohort_a uuid; cohort_b uuid; participant_id uuid; first_version timestamptz; affected integer;
begin
  insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_a') returning id into cohort_a;
  insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_b') returning id into cohort_b;
  perform set_config('ad.test_cohort_id', cohort_a::text, true);
  insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
    values (cohort_a, 'Test Student', 'student@example.test', 'Data Science', '00123456', '3', '010-0000-0000', 'ai_development')
    returning id, updated_at into participant_id, first_version;
  perform set_config('ad.test_participant_id', participant_id::text, true);
  if not exists (select 1 from public."AD_participants" where id = participant_id and student_number = '00123456' and profile_id is null) then raise exception 'Professor create/read or leading-zero preservation failed'; end if;
  update public."AD_participants" set status = 'inactive' where id = participant_id and updated_at = first_version;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Deactivate failed'; end if;
  update public."AD_participants" set grade = '4' where id = participant_id and updated_at = first_version;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale write allowed'; end if;
  update public."AD_participants" set status = 'active' where id = participant_id;

  -- A returning student can be registered in another cohort without another Auth user.
  insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
    values (cohort_b, 'Test Student', 'student@example.test', 'Data Science', '00123456', '3', '010-0000-0000', 'ai_development');
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (cohort_a, 'Duplicate', 'student@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'Duplicate email permitted';
  exception when unique_violation then null; end;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (cohort_a, 'Duplicate', 'other@example.test', 'Data Science', '00123456', '3', '010-0000-0000', 'ai_development');
    raise exception 'Duplicate student number permitted';
  exception when unique_violation then null; end;
  begin
    update public."AD_participants" set email = 'UPPER@EXAMPLE.TEST' where id = participant_id;
    raise exception 'Unnormalized email allowed';
  exception when check_violation then null; end;
  begin
    update public."AD_participants" set phone = '123' where id = participant_id;
    raise exception 'Invalid phone allowed';
  exception when check_violation then null; end;
  begin
    update public."AD_participants" set full_name = '' where id = participant_id;
    raise exception 'Blank name allowed';
  exception when check_violation then null; end;
  begin
    update public."AD_participants" set job_group = 'admin' where id = participant_id;
    raise exception 'Invalid job allowed';
  exception when check_violation then null; end;
  begin
    update public."AD_participants" set profile_id = auth.uid() where id = participant_id;
    raise exception 'Client account linking allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public."AD_participants" set cohort_id = cohort_b where id = participant_id;
    raise exception 'Client cohort reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public."AD_participants" set updated_at = now() where id = participant_id;
    raise exception 'Client timestamp spoofing allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public."AD_participants" where id = participant_id;
    raise exception 'Client delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public."AD_profiles" set role = 'student', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_participants") then raise exception 'student: read allowed'; end if;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (current_setting('ad.test_cohort_id')::uuid, 'Blocked', 'blocked@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'student: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_participants" set status = 'inactive' where id = current_setting('ad.test_participant_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'student: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'consultant', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_participants") then raise exception 'consultant: read allowed'; end if;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (current_setting('ad.test_cohort_id')::uuid, 'Blocked', 'blocked@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'consultant: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_participants" set status = 'inactive' where id = current_setting('ad.test_participant_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'consultant: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'researcher', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_participants") then raise exception 'researcher: read allowed'; end if;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (current_setting('ad.test_cohort_id')::uuid, 'Blocked', 'blocked@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'researcher: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_participants" set status = 'inactive' where id = current_setting('ad.test_participant_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'researcher: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'professor', is_active = false where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_participants") then raise exception 'inactive_professor: read allowed'; end if;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (current_setting('ad.test_cohort_id')::uuid, 'Blocked', 'blocked@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'inactive_professor: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_participants" set status = 'inactive' where id = current_setting('ad.test_participant_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'inactive_professor: update allowed'; end if;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_participants") then raise exception 'unregistered: read allowed'; end if;
  begin
    insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
      values (current_setting('ad.test_cohort_id')::uuid, 'Blocked', 'blocked@example.test', 'Data Science', '00999999', '3', '010-0000-0000', 'ai_development');
    raise exception 'unregistered: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_participants" set status = 'inactive' where id = current_setting('ad.test_participant_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'unregistered: update allowed'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public."AD_participants";
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'AD_participants CRUD, cohort isolation, constraints and access checks passed' as result;
