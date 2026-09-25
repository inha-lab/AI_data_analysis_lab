begin;
create function public."AD_update_team_member_role"(p_team uuid,p_participant uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare actor_participant uuid; actor_leader boolean; professor boolean:=public."AD_is_team_professor"();
begin
  if p_team is null or p_participant is null or p_role is null or char_length(btrim(p_role))>80 then
    raise exception 'Invalid team member role' using errcode='23514';end if;
  perform 1 from public."AD_teams" where id=p_team for share;
  if not found then raise exception 'Team not found' using errcode='23514';end if;
  if not professor then
    select a.id,m.is_leader into actor_participant,actor_leader
    from public."AD_team_members" m join public."AD_participants" a on a.id=m.participant_id
      join public."AD_profiles" p on p.id=a.profile_id
    where m.team_id=p_team and a.profile_id=auth.uid() and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password;
    if actor_participant is null or (not actor_leader and actor_participant<>p_participant) then
      raise exception 'Team role permission required' using errcode='42501';end if;
  end if;
  update public."AD_team_members" set role_title=btrim(p_role)
    where team_id=p_team and participant_id=p_participant;
  if not found then raise exception 'Team member not found' using errcode='23514';end if;
end;
$$;
revoke all on function public."AD_update_team_member_role"(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public."AD_update_team_member_role"(uuid,uuid,text) to authenticated;

create or replace function public."AD_team_workspace"(p_cohort uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'teams',coalesce((select jsonb_agg(t order by t.name,t.id) from (
      select id,cohort_id,name,topic,stage,notion_url,github_url,demo_url,updated_at
      from public."AD_teams" where cohort_id=p_cohort and public."AD_can_read_team"(id)
    ) t),'[]'::jsonb),
    'roster',coalesce((select jsonb_agg(r) from public."AD_team_roster_v2"(p_cohort) r),'[]'::jsonb),
    'candidates',case when public."AD_is_team_professor"()
      then coalesce((select jsonb_agg(c) from public."AD_team_candidates"(p_cohort) c),'[]'::jsonb)
      else '[]'::jsonb end,
    'my_participant_id',(select a.id from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
      where a.cohort_id=p_cohort and a.profile_id=auth.uid() and a.status='active'
        and p.role='student' and p.is_active and not p.must_change_password limit 1)
  );
$$;
notify pgrst,'reload schema';
commit;
