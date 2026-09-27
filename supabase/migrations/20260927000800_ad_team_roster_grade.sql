begin;

create or replace function public."AD_team_workspace"(p_cohort uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'teams',coalesce((select jsonb_agg(t order by t.name,t.id) from (
      select id,cohort_id,name,topic,stage,notion_url,github_url,demo_url,updated_at
      from public."AD_teams" where cohort_id=p_cohort and public."AD_can_read_team"(id)
    ) t),'[]'::jsonb),
    'roster',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('grade',a.grade))
      from public."AD_team_roster_v2"(p_cohort) r join public."AD_participants" a on a.id=r.participant_id),'[]'::jsonb),
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
