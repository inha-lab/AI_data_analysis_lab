begin;

-- All fixtures and temporary role changes are rolled back in this transaction.
do $$
declare professor_id uuid;
begin
  select id into strict professor_id from public."AD_profiles" where role = 'professor' and is_active limit 1;
  perform set_config('request.jwt.claim.sub', professor_id::text, true);
  perform set_config('ad.test_professor', professor_id::text, true);
  perform set_config('ad.test_name', 'AD_TEST_' || gen_random_uuid()::text, true);
  if not (select relrowsecurity from pg_class where oid = 'public."AD_cohorts"'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
  if has_table_privilege('anon', 'public."AD_cohorts"', 'SELECT') then
    raise exception 'Anonymous select grant must not exist';
  end if;
end $$;

set local role authenticated;
do $$
declare row_id uuid; first_version timestamptz; affected integer;
begin
  insert into public."AD_cohorts" (name, starts_on, ends_on)
    values (current_setting('ad.test_name'), '2026-09-24', '2026-09-24')
    returning id, updated_at into row_id, first_version;
  perform set_config('ad.test_cohort_id', row_id::text, true);
  if not exists (select 1 from public."AD_cohorts" where id = row_id and created_by = auth.uid()) then
    raise exception 'Professor insert/read failed';
  end if;
  update public."AD_cohorts" set status = 'active' where id = row_id and updated_at = first_version;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Professor update failed'; end if;
  update public."AD_cohorts" set description = 'stale write' where id = row_id and updated_at = first_version;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale write was not prevented'; end if;

  begin
    insert into public."AD_cohorts" (name) values (lower(current_setting('ad.test_name')));
    raise exception 'Duplicate name accepted';
  exception when unique_violation then null; end;
  begin
    update public."AD_cohorts" set ends_on = '2026-09-23' where id = row_id;
    raise exception 'Reversed dates accepted';
  exception when check_violation then null; end;
  begin
    update public."AD_cohorts" set ends_on = null where id = row_id;
    raise exception 'Partial dates accepted';
  exception when check_violation then null; end;
  begin
    update public."AD_cohorts" set name = ' ' where id = row_id;
    raise exception 'Blank name accepted';
  exception when check_violation then null; end;
  begin
    update public."AD_cohorts" set status = 'invalid' where id = row_id;
    raise exception 'Invalid status accepted';
  exception when check_violation then null; end;
  begin
    update public."AD_cohorts" set created_by = gen_random_uuid() where id = row_id;
    raise exception 'Creator change permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public."AD_cohorts" set updated_at = now() where id = row_id;
    raise exception 'Client timestamp change permitted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public."AD_cohorts" where id = row_id;
    raise exception 'Client delete permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public."AD_profiles" set role = 'student', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_cohorts") then raise exception 'student: read allowed'; end if;
  begin
    insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_blocked');
    raise exception 'student: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_cohorts" set status = 'completed' where id = current_setting('ad.test_cohort_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'student: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'consultant', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_cohorts") then raise exception 'consultant: read allowed'; end if;
  begin
    insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_blocked');
    raise exception 'consultant: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_cohorts" set status = 'completed' where id = current_setting('ad.test_cohort_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'consultant: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'researcher', is_active = true where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_cohorts") then raise exception 'researcher: read allowed'; end if;
  begin
    insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_blocked');
    raise exception 'researcher: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_cohorts" set status = 'completed' where id = current_setting('ad.test_cohort_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'researcher: update allowed'; end if;
end $$;
reset role;

update public."AD_profiles" set role = 'professor', is_active = false where id = current_setting('ad.test_professor')::uuid;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_cohorts") then raise exception 'inactive_professor: read allowed'; end if;
  begin
    insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_blocked');
    raise exception 'inactive_professor: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_cohorts" set status = 'completed' where id = current_setting('ad.test_cohort_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'inactive_professor: update allowed'; end if;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public."AD_cohorts") then raise exception 'unregistered: read allowed'; end if;
  begin
    insert into public."AD_cohorts" (name) values (current_setting('ad.test_name') || '_blocked');
    raise exception 'unregistered: insert allowed';
  exception when insufficient_privilege then null; end;
  update public."AD_cohorts" set status = 'completed' where id = current_setting('ad.test_cohort_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'unregistered: update allowed'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public."AD_cohorts";
    raise exception 'Anonymous read permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'AD_cohorts CRUD, constraints, concurrency and role checks passed' as result;
