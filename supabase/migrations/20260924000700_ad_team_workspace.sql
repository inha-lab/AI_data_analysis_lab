begin;
-- One stable statement returns the team version and roster from the same snapshot.
-- Separate REST requests could otherwise pair a new version with an old roster.
create function public."AD_team_workspace"(p_cohort uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(t order by t.name, t.id) from (
      select id, cohort_id, name, topic, stage, notion_url, github_url, demo_url, updated_at
      from public."AD_teams" where cohort_id = p_cohort and public."AD_can_read_team"(id)
    ) t), '[]'::jsonb),
    'roster', coalesce((select jsonb_agg(r) from public."AD_team_roster"(p_cohort) r), '[]'::jsonb),
    'candidates', case when public."AD_is_team_professor"()
      then coalesce((select jsonb_agg(c) from public."AD_team_candidates"(p_cohort) c), '[]'::jsonb)
      else '[]'::jsonb end
  );
$$;
revoke all on function public."AD_team_workspace"(uuid) from public, anon, authenticated;
grant execute on function public."AD_team_workspace"(uuid) to authenticated;
commit;
