begin;
create function public."AD_delete_participant"(p_participant uuid,p_version timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare row public."AD_participants"%rowtype;
begin
  if not public."AD_is_team_professor"() then raise exception 'Manager permission required' using errcode='42501'; end if;
  select * into row from public."AD_participants" where id=p_participant for update;
  if not found or row.updated_at is distinct from p_version then raise exception 'Participant changed' using errcode='40001'; end if;
  if exists(select 1 from public."AD_team_members" where participant_id=p_participant) then raise exception 'Participant belongs to a team' using errcode='23503'; end if;
  delete from public."AD_participants" where id=p_participant;
  return p_participant;
end;$$;
create function public."AD_delete_team"(p_team uuid,p_version timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare row public."AD_teams"%rowtype;
begin
  if not public."AD_is_team_professor"() then raise exception 'Manager permission required' using errcode='42501'; end if;
  select * into row from public."AD_teams" where id=p_team for update;
  if not found or row.updated_at is distinct from p_version then raise exception 'Team changed' using errcode='40001'; end if;
  delete from public."AD_team_members" where team_id=p_team;
  delete from public."AD_teams" where id=p_team;
  return p_team;
end;$$;
revoke all on function public."AD_delete_participant"(uuid,timestamptz),public."AD_delete_team"(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_delete_participant"(uuid,timestamptz),public."AD_delete_team"(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
