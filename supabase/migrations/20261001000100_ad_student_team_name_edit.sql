begin;

create or replace function public."AD_update_team_project"(p_team uuid, p_version timestamptz, p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare team public."AD_teams"%rowtype;
begin
  select * into team from public."AD_teams" where id = p_team for update;
  if not found or not public."AD_can_read_team"(p_team) then raise exception 'Team permission required' using errcode = '42501'; end if;
  if team.updated_at is distinct from p_version then raise exception 'Team changed' using errcode = '40001'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' or (select count(*) from jsonb_object_keys(p_values)) <> 6 then raise exception 'Invalid fields' using errcode = '23514'; end if;
  if exists (select 1 from jsonb_object_keys(p_values) k where k not in ('name','topic','stage','notion_url','github_url','demo_url')) then raise exception 'Unsupported fields' using errcode = '42501'; end if;
  update public."AD_teams" set name = btrim(p_values->>'name'), topic = p_values->>'topic', stage = p_values->>'stage',
    notion_url = p_values->>'notion_url', github_url = p_values->>'github_url', demo_url = p_values->>'demo_url' where id = p_team;
  return p_team;
end;
$$;

revoke all on function public."AD_update_team_project"(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public."AD_update_team_project"(uuid,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';

commit;
