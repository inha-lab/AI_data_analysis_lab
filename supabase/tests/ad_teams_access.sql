begin;
-- All Auth users, existing Auth-trigger effects and AD fixtures are rolled back.
do $$
declare actor uuid; student1 uuid := gen_random_uuid(); student2 uuid := gen_random_uuid(); c1 uuid; c2 uuid; p1 uuid; p2 uuid; other_p uuid; unlinked uuid; suffix text := gen_random_uuid()::text;
begin
  select id into strict actor from public."AD_profiles" where role = 'professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('ad.team_actor', actor::text, true);
  insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data) values
    (student1, 'ad-team-1-' || suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb),
    (student2, 'ad-team-2-' || suffix || '@example.invalid', '{}'::jsonb, '{}'::jsonb);
  insert into public."AD_profiles" (id, display_name, role) values (student1, 'Team Test One', 'student'), (student2, 'Team Test Two', 'student');
  insert into public."AD_cohorts" (name) values ('AD_TEAM_A_' || suffix) returning id into c1;
  insert into public."AD_cohorts" (name) values ('AD_TEAM_B_' || suffix) returning id into c2;
  insert into public."AD_participants" (cohort_id, profile_id, full_name, email, department, student_number, grade, phone, job_group)
    values (c1, student1, 'Test One', 'one@example.invalid', 'Test', '001', '3', '010-0000-0000', 'ai_development') returning id into p1;
  insert into public."AD_participants" (cohort_id, profile_id, full_name, email, department, student_number, grade, phone, job_group)
    values (c1, student2, 'Test Two', 'two@example.invalid', 'Test', '002', '3', '010-0000-0000', 'sw_development') returning id into p2;
  insert into public."AD_participants" (cohort_id, profile_id, full_name, email, department, student_number, grade, phone, job_group)
    values (c2, student2, 'Test Other', 'two@example.invalid', 'Test', '002', '3', '010-0000-0000', 'sw_development') returning id into other_p;
  insert into public."AD_participants" (cohort_id, full_name, email, department, student_number, grade, phone, job_group)
    values (c1, 'Unlinked', 'unlinked@example.invalid', 'Test', '003', '3', '010-0000-0000', 'ai_development') returning id into unlinked;
  perform set_config('ad.team_s1', student1::text, true); perform set_config('ad.team_s2', student2::text, true);
  perform set_config('ad.team_c1', c1::text, true); perform set_config('ad.team_c2', c2::text, true);
  perform set_config('ad.team_p1', p1::text, true); perform set_config('ad.team_p2', p2::text, true);
  perform set_config('ad.team_other_p', other_p::text, true); perform set_config('ad.team_unlinked', unlinked::text, true);
  if not (select bool_and(relrowsecurity) from pg_class where oid in ('public."AD_teams"'::regclass, 'public."AD_team_members"'::regclass)) then raise exception 'RLS disabled'; end if;
end $$;
set local role authenticated;
do $$
declare c1 uuid := current_setting('ad.team_c1')::uuid; c2 uuid := current_setting('ad.team_c2')::uuid; p1 uuid := current_setting('ad.team_p1')::uuid; p2 uuid := current_setting('ad.team_p2')::uuid;
  data jsonb := '{"name":"Team A","topic":"Test","stage":"planning","notion_url":"","github_url":"https://github.com/example/test","demo_url":""}';
  t1 uuid; t2 uuid; t3 uuid; first_version timestamptz; v timestamptz;
begin
  if (select count(*) from public."AD_team_candidates"(c1)) <> 3 then raise exception 'Candidate list incorrect'; end if;
  if not exists (select 1 from public."AD_team_candidates"(c1) where participant_id = current_setting('ad.team_unlinked')::uuid and eligibility = 'unlinked') then raise exception 'Unlinked candidate not flagged'; end if;
  t1 := public."AD_save_team"(c1, data, array[p1,p2], p1);
  t2 := public."AD_save_team"(c1, data || '{"name":"Team B"}'::jsonb, '{}'::uuid[], null);
  t3 := public."AD_save_team"(c2, data, array[current_setting('ad.team_other_p')::uuid], null);
  perform set_config('ad.team_t1', t1::text, true); perform set_config('ad.team_t2', t2::text, true); perform set_config('ad.team_t3', t3::text, true);
  select updated_at into first_version from public."AD_teams" where id = t1;
  perform public."AD_save_team"(c1, data, array[p1,p2], p2, t1, first_version);
  if not exists (select 1 from public."AD_team_roster"(c1) where participant_id = p2 and is_leader) then raise exception 'Leader not changed'; end if;
  if exists (select 1 from public."AD_team_roster"(c1) where participant_id = p1 and is_leader) then raise exception 'Old leader retained'; end if;
  begin perform public."AD_save_team"(c1, data, array[p1,p2], p1, t1, first_version); raise exception 'Stale write accepted'; exception when serialization_failure then null; end;
  begin perform public."AD_save_team"(c1, data, '{}'::uuid[], null); raise exception 'Duplicate name accepted'; exception when unique_violation then null; end;
  select updated_at into v from public."AD_teams" where id = t2;
  begin perform public."AD_save_team"(c1, data || '{"name":"Team B"}'::jsonb, array[p1], p1, t2, v); raise exception 'Duplicate team assignment accepted'; exception when unique_violation then null; end;
  begin perform public."AD_save_team"(c1, data, array[current_setting('ad.team_other_p')::uuid], null); raise exception 'Cross-program member accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_team"(c1, data, array[current_setting('ad.team_unlinked')::uuid], null); raise exception 'Unlinked member accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_team"(c1, data, array[p1,p1], null); raise exception 'Duplicate array accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_team"(c1, data, '{}'::uuid[], p1); raise exception 'Nonmember leader accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_team"(c1, data || '{"name":"Unsafe","demo_url":"javascript:alert(1)"}'::jsonb, '{}'::uuid[], null); raise exception 'Unsafe URL accepted'; exception when check_violation then null; end;
  begin perform public."AD_save_team"(c1, data || '{"name":"Bad stage","stage":"invalid"}'::jsonb, '{}'::uuid[], null); raise exception 'Bad stage accepted'; exception when check_violation then null; end;
  select updated_at into v from public."AD_teams" where id = t1;
  begin perform public."AD_delete_empty_team"(t1, v); raise exception 'Nonempty team deleted'; exception when foreign_key_violation then null; end;
  begin update public."AD_teams" set name = 'Direct' where id = t1; raise exception 'Direct write permitted'; exception when insufficient_privilege then null; end;
  begin perform 1 from public."AD_team_members"; raise exception 'Raw membership read permitted'; exception when insufficient_privilege then null; end;
  if (select count(*) from public."AD_team_roster"(c1)) <> 2 then raise exception 'Failed transaction damaged roster'; end if;
  if jsonb_array_length(public."AD_team_workspace"(c1)->'teams') <> 2 or jsonb_array_length(public."AD_team_workspace"(c1)->'candidates') <> 3 then raise exception 'Professor workspace incorrect'; end if;
  if not exists (select 1 from jsonb_array_elements(public."AD_team_workspace"(c1)->'teams') t join public."AD_teams" source on source.id = (t->>'id')::uuid where source.id = t1 and source.updated_at = (t->>'updated_at')::timestamptz) then raise exception 'Workspace version missing'; end if;
end $$;
reset role;
-- Database-level composite keys and leader uniqueness hold independently of RPC validation.
do $$ begin
  begin update public."AD_team_members" set is_leader = true where participant_id = current_setting('ad.team_p1')::uuid; raise exception 'Two leaders accepted'; exception when unique_violation then null; end;
  begin update public."AD_team_members" set cohort_id = current_setting('ad.team_c2')::uuid where participant_id = current_setting('ad.team_p1')::uuid; raise exception 'Cross-program key accepted'; exception when foreign_key_violation then null; end;
  perform set_config('request.jwt.claim.sub', current_setting('ad.team_s1'), true);
end $$;
set local role authenticated;
do $$
declare t1 uuid := current_setting('ad.team_t1')::uuid; v timestamptz;
  data jsonb := '{"topic":"Student update","stage":"design","notion_url":"","github_url":"","demo_url":"https://example.com/demo"}';
begin
  if (select count(*) from public."AD_teams") <> 1 then raise exception 'Student can read another team'; end if;
  if jsonb_array_length(public."AD_team_workspace"(current_setting('ad.team_c1')::uuid)->'teams') <> 1 or jsonb_array_length(public."AD_team_workspace"(current_setting('ad.team_c1')::uuid)->'candidates') <> 0 then raise exception 'Student workspace leaks data'; end if;
  if (select count(*) from public."AD_team_roster"(current_setting('ad.team_c1')::uuid)) <> 2 then raise exception 'Own roster unavailable'; end if;
  if exists (select 1 from public."AD_team_roster"(current_setting('ad.team_c2')::uuid)) then raise exception 'Other program roster exposed'; end if;
  if (select count(*) from public."AD_participants") <> 1 then raise exception 'Private participant access broadened'; end if;
  if exists (select 1 from public."AD_team_roster"(current_setting('ad.team_c1')::uuid) r where to_jsonb(r) ?| array['email','phone','student_number','profile_id']) then raise exception 'Private fields in roster'; end if;
  select updated_at into v from public."AD_teams" where id = t1;
  perform public."AD_update_team_project"(t1, v, data);
  begin perform public."AD_update_team_project"(t1, v, data); raise exception 'Stale student write accepted'; exception when serialization_failure then null; end;
  select updated_at into v from public."AD_teams" where id = t1;
  begin perform public."AD_update_team_project"(t1, v, data || '{"name":"Forbidden"}'::jsonb); raise exception 'Student renamed team'; exception when insufficient_privilege then null; end;
  begin perform public."AD_update_team_project"(current_setting('ad.team_t2')::uuid, v, data); raise exception 'Other team write permitted'; exception when insufficient_privilege then null; end;
  begin perform public."AD_save_team"(current_setting('ad.team_c1')::uuid, data, '{}'::uuid[], null); raise exception 'Student roster write permitted'; exception when insufficient_privilege then null; end;
  begin perform public."AD_delete_empty_team"(current_setting('ad.team_t2')::uuid, v); raise exception 'Student delete permitted'; exception when insufficient_privilege then null; end;
  begin perform public."AD_team_candidates"(current_setting('ad.team_c1')::uuid); raise exception 'Student candidate enumeration'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public."AD_participants" set status = 'inactive' where id = current_setting('ad.team_p1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_teams") then raise exception 'Inactive participant read permitted'; end if; end $$;
reset role;
update public."AD_participants" set status = 'active' where id = current_setting('ad.team_p1')::uuid;
update public."AD_profiles" set must_change_password = true where id = current_setting('ad.team_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_teams") then raise exception 'Pending password read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set must_change_password = false, is_active = false where id = current_setting('ad.team_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_teams") then raise exception 'Inactive profile read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set is_active = true, role = 'consultant' where id = current_setting('ad.team_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_teams") then raise exception 'Consultant read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set role = 'researcher' where id = current_setting('ad.team_s1')::uuid;
set local role authenticated;
do $$ begin if exists (select 1 from public."AD_teams") then raise exception 'Researcher read permitted'; end if; end $$;
reset role;
update public."AD_profiles" set role = 'student' where id = current_setting('ad.team_s1')::uuid;
do $$ begin perform set_config('request.jwt.claim.sub', current_setting('ad.team_actor'), true); end $$;
set local role authenticated;
do $$
declare data jsonb; v timestamptz; t1 uuid := current_setting('ad.team_t1')::uuid; t2 uuid := current_setting('ad.team_t2')::uuid;
begin
  select jsonb_build_object('name', name, 'topic', topic, 'stage', stage, 'notion_url', notion_url, 'github_url', github_url, 'demo_url', demo_url), updated_at into data, v from public."AD_teams" where id = t1;
  perform public."AD_save_team"(current_setting('ad.team_c1')::uuid, data, array[current_setting('ad.team_p2')::uuid], null, t1, v);
  select updated_at into v from public."AD_teams" where id = t2;
  perform public."AD_delete_empty_team"(t2, v);
  if exists (select 1 from public."AD_teams" where id = t2) then raise exception 'Empty deletion failed'; end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub', current_setting('ad.team_s1'), true); end $$;
set local role authenticated;
do $$ begin
  if exists (select 1 from public."AD_teams") or exists (select 1 from public."AD_team_roster"(current_setting('ad.team_c1')::uuid)) then raise exception 'Removed member retained access'; end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); end $$;
set local role authenticated;
do $$ begin
  if exists (select 1 from public."AD_teams") then raise exception 'Unregistered access permitted'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public."AD_teams"; raise exception 'Anonymous team read'; exception when insufficient_privilege then null; end;
  begin perform 1 from public."AD_team_members"; raise exception 'Anonymous membership read'; exception when insufficient_privilege then null; end;
  begin perform public."AD_team_roster"(current_setting('ad.team_c1')::uuid); raise exception 'Anonymous roster RPC'; exception when insufficient_privilege then null; end;
  begin perform public."AD_team_workspace"(current_setting('ad.team_c1')::uuid); raise exception 'Anonymous workspace RPC'; exception when insufficient_privilege then null; end;
  begin perform public."AD_save_team"(current_setting('ad.team_c1')::uuid, '{}'::jsonb, '{}'::uuid[], null); raise exception 'Anonymous mutation RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'AD_teams atomic roster, leader, eligibility, privacy, role restrictions, stale writes and deletion passed; fixtures rolled back' as result;
