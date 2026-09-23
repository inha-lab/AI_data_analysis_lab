begin;

-- Verify only this app's table, without modifying production data.
do $$
declare professor_id uuid;
begin
  select id into strict professor_id from public."AD_profiles" where role = 'professor' and is_active limit 1;
  if not (select relrowsecurity from pg_class where oid = 'public."AD_profiles"'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
  if has_table_privilege('anon', 'public."AD_profiles"', 'SELECT') then
    raise exception 'Anonymous reads must be denied';
  end if;
  if has_table_privilege('authenticated', 'public."AD_profiles"', 'INSERT')
    or has_table_privilege('authenticated', 'public."AD_profiles"', 'UPDATE')
    or has_table_privilege('authenticated', 'public."AD_profiles"', 'DELETE') then
    raise exception 'Client writes must be denied';
  end if;
  perform set_config('request.jwt.claim.sub', professor_id::text, true);
end $$;

set local role authenticated;
do $$
begin
  if (select count(*) from public."AD_profiles") <> 1 then
    raise exception 'Registered professor must read exactly their own profile';
  end if;
  if not exists (select 1 from public."AD_profiles" where id = auth.uid() and role = 'professor') then
    raise exception 'Professor profile not visible';
  end if;
end $$;
reset role;

do $$
begin
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
end $$;
set local role authenticated;
do $$
begin
  if exists (select 1 from public."AD_profiles") then
    raise exception 'Unregistered user must not see app profiles';
  end if;
end $$;
reset role;
rollback;
select 'AD_profiles access checks passed' as result;
