begin;

create or replace function public."AD_review_proposal"(p_team uuid, p_version timestamptz, p_action text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_proposals"%rowtype; actor_name text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  perform 1 from public."AD_teams" where id = p_team for update;
  select * into previous from public."AD_proposals" where team_id = p_team;
  if not found or previous.updated_at is distinct from p_version then raise exception 'Proposal changed' using errcode = '40001'; end if;
  if p_action is distinct from 'reviewed' or coalesce(char_length(p_note), 0) > 4000 then raise exception 'Invalid review' using errcode = '23514'; end if;
  if previous.status <> 'submitted' then raise exception 'Invalid review transition' using errcode = '55000'; end if;
  select coalesce(nullif(display_name, ''), '교수') into actor_name from public."AD_profiles" where id = auth.uid();
  update public."AD_proposals" set status = 'reviewed', review_note = '', review_action = 'reviewed',
    reviewed_at = clock_timestamp(), reviewed_by = auth.uid(), reviewer_name = actor_name,
    updated_by = auth.uid(), updated_name = actor_name where team_id = p_team;
  return p_team;
end;
$$;

create or replace function public."AD_review_report"(p_report uuid, p_version timestamptz, p_action text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."AD_reports"%rowtype; actor_name text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode = '42501'; end if;
  perform 1 from public."AD_teams" where id = (select team_id from public."AD_reports" where id = p_report) for update;
  select * into previous from public."AD_reports" where id = p_report for update;
  if not found or previous.updated_at is distinct from p_version then raise exception 'Report changed' using errcode = '40001'; end if;
  if p_action is distinct from 'reviewed' or coalesce(char_length(p_note), 0) > 4000 then raise exception 'Invalid review' using errcode = '23514'; end if;
  if previous.status <> 'submitted' then raise exception 'Invalid review transition' using errcode = '55000'; end if;
  select coalesce(nullif(display_name, ''), '교수') into actor_name from public."AD_profiles" where id = auth.uid();
  update public."AD_reports" set status = 'reviewed', review_note = '', review_action = 'reviewed',
    reviewed_at = clock_timestamp(), reviewed_by = auth.uid(), reviewer_name = actor_name,
    updated_by = auth.uid(), updated_name = actor_name where id = p_report;
  return p_report;
end;
$$;

revoke all on function public."AD_review_proposal"(uuid,timestamptz,text,text), public."AD_review_report"(uuid,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public."AD_review_proposal"(uuid,timestamptz,text,text), public."AD_review_report"(uuid,timestamptz,text,text) to authenticated;

commit;
