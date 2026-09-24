begin;
create table public."AD_comments" (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public."AD_teams"(id) on delete restrict,
  proposal_team_id uuid references public."AD_proposals"(team_id) on delete restrict,
  report_id uuid references public."AD_reports"(id) on delete restrict,
  author_id uuid not null references public."AD_profiles"(id) on delete restrict,
  author_name text not null,
  body text not null check (body=btrim(body) and char_length(body) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint "AD_comments_one_target" check ((proposal_team_id is not null)::int+(report_id is not null)::int=1),
  constraint "AD_comments_proposal_team" check (proposal_team_id is null or proposal_team_id=team_id)
);
create index "AD_comments_team_created" on public."AD_comments"(team_id,created_at,id);
create index "AD_comments_report_created" on public."AD_comments"(report_id,created_at,id) where report_id is not null;
create function public."AD_comments_validate_target"() returns trigger language plpgsql set search_path='' as $$
begin
  if new.report_id is not null and not exists(select 1 from public."AD_reports" where id=new.report_id and team_id=new.team_id) then
    raise exception 'Report does not belong to team' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public."AD_comments_validate_target"() from public,anon,authenticated;
create trigger "AD_comments_target" before insert or update on public."AD_comments" for each row execute function public."AD_comments_validate_target"();
alter table public."AD_comments" enable row level security;
revoke all on public."AD_comments" from anon,authenticated;
grant select on public."AD_comments" to authenticated;
grant all on public."AD_comments" to service_role;
create policy "AD_comments_team_select" on public."AD_comments" for select to authenticated using (public."AD_can_read_team"(team_id));

create function public."AD_save_comment"(p_team uuid,p_proposal boolean,p_report uuid,p_comment uuid,p_version timestamptz,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_comments"%rowtype; actor_name text; result_id uuid;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  if p_proposal is null or p_proposal=(p_report is not null) or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Invalid comment' using errcode='23514';
  end if;
  if p_proposal then
    if not exists(select 1 from public."AD_proposals" where team_id=p_team) then raise exception 'Proposal not found' using errcode='23514'; end if;
  elsif not exists(select 1 from public."AD_reports" where id=p_report and team_id=p_team) then
    raise exception 'Report not found' using errcode='23514';
  end if;
  if p_comment is not null then
    select * into previous from public."AD_comments" where id=p_comment for update;
    if not found or previous.team_id<>p_team or previous.proposal_team_id is distinct from (case when p_proposal then p_team end)
      or previous.report_id is distinct from p_report or previous.author_id<>auth.uid() then
      raise exception 'Comment owner required' using errcode='42501';
    end if;
    if previous.updated_at is distinct from p_version then raise exception 'Comment changed' using errcode='40001'; end if;
    update public."AD_comments" set body=btrim(p_body),updated_at=clock_timestamp() where id=p_comment returning id into result_id;
  else
    select coalesce(nullif(display_name,''),'교수') into actor_name from public."AD_profiles" where id=auth.uid();
    insert into public."AD_comments"(team_id,proposal_team_id,report_id,author_id,author_name,body)
      values(p_team,case when p_proposal then p_team end,p_report,auth.uid(),actor_name,btrim(p_body)) returning id into result_id;
  end if;
  return result_id;
end;
$$;
create function public."AD_delete_comment"(p_comment uuid,p_version timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_comments"%rowtype;
begin
  perform 1 from public."AD_teams" where id=(select team_id from public."AD_comments" where id=p_comment) for update;
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  select * into previous from public."AD_comments" where id=p_comment for update;
  if not found or previous.author_id<>auth.uid() then raise exception 'Comment owner required' using errcode='42501'; end if;
  if previous.updated_at is distinct from p_version then raise exception 'Comment changed' using errcode='40001'; end if;
  delete from public."AD_comments" where id=p_comment;
end;
$$;
revoke all on function public."AD_save_comment"(uuid,boolean,uuid,uuid,timestamptz,text),public."AD_delete_comment"(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_save_comment"(uuid,boolean,uuid,uuid,timestamptz,text),public."AD_delete_comment"(uuid,timestamptz) to authenticated;
commit;
