begin;
alter table public."AD_comments" add column deliverable_id uuid references public."AD_deliverables"(id) on delete restrict;
alter table public."AD_comments" drop constraint "AD_comments_one_target";
alter table public."AD_comments" add constraint "AD_comments_one_target" check (
  (proposal_team_id is not null)::int+(report_id is not null)::int+(deliverable_id is not null)::int=1
);
create index "AD_comments_deliverable_created" on public."AD_comments"(deliverable_id,created_at,id) where deliverable_id is not null;
create or replace function public."AD_comments_validate_target"() returns trigger language plpgsql set search_path='' as $$
begin
  if new.report_id is not null and not exists(select 1 from public."AD_reports" where id=new.report_id and team_id=new.team_id) then
    raise exception 'Report does not belong to team' using errcode='23514';
  end if;
  if new.deliverable_id is not null and not exists(select 1 from public."AD_deliverables" where id=new.deliverable_id and team_id=new.team_id) then
    raise exception 'Deliverable does not belong to team' using errcode='23514';
  end if;
  return new;
end;
$$;

create function public."AD_save_deliverable_comment"(p_team uuid,p_deliverable uuid,p_comment uuid,p_version timestamptz,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_comments"%rowtype; actor_name text; result_id uuid;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  if p_deliverable is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 or
    not exists(select 1 from public."AD_deliverables" where id=p_deliverable and team_id=p_team) then
    raise exception 'Invalid deliverable comment' using errcode='23514';
  end if;
  if p_comment is not null then
    select * into previous from public."AD_comments" where id=p_comment for update;
    if not found or previous.team_id<>p_team or previous.deliverable_id is distinct from p_deliverable or previous.author_id<>auth.uid() then
      raise exception 'Comment owner required' using errcode='42501';
    end if;
    if previous.updated_at is distinct from p_version then raise exception 'Comment changed' using errcode='40001'; end if;
    update public."AD_comments" set body=btrim(p_body),updated_at=clock_timestamp() where id=p_comment returning id into result_id;
  else
    select coalesce(nullif(display_name,''),'교수') into actor_name from public."AD_profiles" where id=auth.uid();
    insert into public."AD_comments"(team_id,deliverable_id,author_id,author_name,body)
      values(p_team,p_deliverable,auth.uid(),actor_name,btrim(p_body)) returning id into result_id;
  end if;
  return result_id;
end;
$$;
revoke all on function public."AD_save_deliverable_comment"(uuid,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public."AD_save_deliverable_comment"(uuid,uuid,uuid,timestamptz,text) to authenticated;
commit;
