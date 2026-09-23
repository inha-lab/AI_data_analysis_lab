begin;
-- Fixtures and temporary role changes stay in this transaction and are rolled back.
do $$
declare actor uuid; c1 uuid; c2 uuid;
begin
  select id into strict actor from public."AD_profiles" where role = 'professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('ad.test_actor', actor::text, true);
  insert into public."AD_cohorts" (name) values ('AD_SCHEDULE_TEST_' || gen_random_uuid()) returning id into c1;
  insert into public."AD_cohorts" (name) values ('AD_SCHEDULE_TEST_' || gen_random_uuid()) returning id into c2;
  perform set_config('ad.test_c1', c1::text, true);
  perform set_config('ad.test_c2', c2::text, true);
  insert into public."AD_participants" (cohort_id, profile_id, full_name, email, department, student_number, grade, phone, job_group)
    values (c1, actor, 'Schedule Test', 'schedule@example.test', 'Test', '0001', '1', '010-0000-0000', 'ai_development');
  if not (select relrowsecurity from pg_class where oid = 'public."AD_schedules"'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
set local role authenticated;
do $$
declare c1 uuid := current_setting('ad.test_c1')::uuid; c2 uuid := current_setting('ad.test_c2')::uuid; item uuid; version timestamptz; affected integer;
begin
  insert into public."AD_schedules" (cohort_id, title, stage, starts_at, ends_at)
    values (c1, 'Private one', 'planning', '2026-09-24T09:00+09:00', '2026-09-24T10:00+09:00') returning id, updated_at into item, version;
  perform set_config('ad.test_schedule', item::text, true);
  insert into public."AD_schedules" (cohort_id, title, stage, kind, starts_at, ends_at, is_public)
    values (c1, 'Public deadline', 'design', 'deadline', '2026-09-25T18:00+09:00', '2026-09-25T18:00+09:00', true),
           (c2, 'Other public', 'design', 'deadline', '2026-09-25T18:00+09:00', '2026-09-25T18:00+09:00', true),
           (c2, 'Other private', 'design', 'deadline', '2026-09-25T18:00+09:00', '2026-09-25T18:00+09:00', false);
  if (select count(*) from public."AD_schedules" where cohort_id in (c1, c2)) <> 4 then raise exception 'Professor read failed'; end if;
  update public."AD_schedules" set description = 'Updated' where id = item and updated_at = version;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Professor update failed'; end if;
  update public."AD_schedules" set description = 'Stale' where id = item and updated_at = version;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale update permitted'; end if;
  begin update public."AD_schedules" set ends_at = starts_at - interval '1 second' where id = item; raise exception 'Reversed dates accepted'; exception when check_violation then null; end;
  begin update public."AD_schedules" set kind = 'deadline' where id = item; raise exception 'Deadline range accepted'; exception when check_violation then null; end;
  begin update public."AD_schedules" set ends_at = 'infinity' where id = item; raise exception 'Infinity accepted'; exception when check_violation then null; end;
  begin update public."AD_schedules" set title = ' ' where id = item; raise exception 'Blank title accepted'; exception when check_violation then null; end;
  begin update public."AD_schedules" set stage = 'invalid' where id = item; raise exception 'Invalid stage accepted'; exception when check_violation then null; end;
  begin update public."AD_schedules" set cohort_id = c2 where id = item; raise exception 'Program reassignment permitted'; exception when insufficient_privilege then null; end;
  begin update public."AD_schedules" set created_by = auth.uid() where id = item; raise exception 'Creator mutation permitted'; exception when insufficient_privilege then null; end;
  begin update public."AD_schedules" set updated_at = now() where id = item; raise exception 'Timestamp mutation permitted'; exception when insufficient_privilege then null; end;
  begin delete from public."AD_schedules" where id = item; raise exception 'Delete permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
  if (select count(*) from public."AD_public_schedules"() where cohort_id in (current_setting('ad.test_c1')::uuid, current_setting('ad.test_c2')::uuid)) <> 2 then raise exception 'Public projection incorrect'; end if;
  if exists (select 1 from public."AD_public_schedules"() where id = current_setting('ad.test_schedule')::uuid) then raise exception 'Private schedule leaked'; end if;
  begin perform 1 from public."AD_schedules"; raise exception 'Anonymous table read permitted'; exception when insufficient_privilege then null; end;
  begin perform 1 from public."AD_cohorts"; raise exception 'Anonymous cohort read permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public."AD_profiles" set role = 'student' where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if (select count(*) from public."AD_schedules" where cohort_id = current_setting('ad.test_c1')::uuid) <> 2 then raise exception 'Member read failed'; end if;
  if exists (select 1 from public."AD_schedules" where cohort_id = current_setting('ad.test_c2')::uuid) then raise exception 'Other program leaked'; end if;
  update public."AD_schedules" set is_public = true where id = current_setting('ad.test_schedule')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Student write permitted'; end if;
  begin
    insert into public."AD_schedules" (cohort_id, title, stage, starts_at, ends_at) values (current_setting('ad.test_c1')::uuid, 'Denied', 'planning', now(), now());
    raise exception 'Student insert permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public."AD_participants" set status = 'inactive' where cohort_id = current_setting('ad.test_c1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Inactive membership read permitted'; end if; end $$;
reset role;
update public."AD_participants" set status = 'active' where cohort_id = current_setting('ad.test_c1')::uuid;
update public."AD_profiles" set must_change_password = true where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Pending password read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set must_change_password = false, is_active = false where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Inactive profile read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set role = 'consultant', is_active = true where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Consultant read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set role = 'researcher' where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Researcher read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set role = 'professor', must_change_password = true where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_schedules") then raise exception 'Pending professor read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set must_change_password = false where id = current_setting('ad.test_actor')::uuid;
set local role authenticated;
update public."AD_schedules" set is_public = false, is_cancelled = true where cohort_id = current_setting('ad.test_c1')::uuid;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); end $$;
set local role authenticated;
do $$ begin
  if exists (select 1 from public."AD_schedules") then raise exception 'Unregistered read permitted'; end if;
  if exists (select 1 from public."AD_public_schedules"() where cohort_id = current_setting('ad.test_c1')::uuid) then raise exception 'Unpublished schedule leaked'; end if;
end $$;
reset role;
rollback;
select 'AD_schedules CRUD, public projection, memberships, constraints and concurrency passed; fixtures rolled back' as result;
