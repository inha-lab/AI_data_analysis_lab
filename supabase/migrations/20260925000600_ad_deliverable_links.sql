begin;
create table public."AD_deliverables" (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public."AD_teams"(id) on delete restrict,
  category text not null check(category in ('data_source','data_dictionary','analysis','model_validation','github','notion','presentation','demo','erd','uml','other')),
  title text not null check(title=btrim(title) and char_length(title) between 1 and 120),
  description text not null default '' check(char_length(description)<=4000),
  url text not null check(url<>'' and char_length(url)<=2000 and public."AD_team_url_valid"(url)),
  submitted_by uuid not null references public."AD_profiles"(id) on delete restrict,
  submitted_name text not null,
  submitted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index "AD_deliverables_team_submitted" on public."AD_deliverables"(team_id,submitted_at desc,id);
create function public."AD_deliverables_touch_updated_at"() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp();return new;end;
$$;
revoke all on function public."AD_deliverables_touch_updated_at"() from public,anon,authenticated;
create trigger "AD_deliverables_updated_at" before update on public."AD_deliverables" for each row execute function public."AD_deliverables_touch_updated_at"();
alter table public."AD_deliverables" enable row level security;
revoke all on public."AD_deliverables" from anon,authenticated;
grant select on public."AD_deliverables" to authenticated;
grant all on public."AD_deliverables" to service_role;
create policy "AD_deliverables_team_select" on public."AD_deliverables" for select to authenticated using(public."AD_can_read_team"(team_id));

create function public."AD_save_deliverable"(p_team uuid,p_deliverable uuid,p_version timestamptz,p_values jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_deliverables"%rowtype; actor_name text; result_id uuid; field text;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password) then
    raise exception 'Current student membership required' using errcode='42501';
  end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' or (select count(*) from jsonb_object_keys(p_values))<>4 then raise exception 'Invalid fields' using errcode='23514';end if;
  foreach field in array array['category','title','description','url'] loop
    if jsonb_typeof(p_values->field) is distinct from 'string' then raise exception 'Missing text field' using errcode='23514';end if;
  end loop;
  select coalesce(nullif(display_name,''),'학생') into actor_name from public."AD_profiles" where id=auth.uid();
  if p_deliverable is null then
    insert into public."AD_deliverables"(team_id,category,title,description,url,submitted_by,submitted_name)
      values(p_team,p_values->>'category',btrim(p_values->>'title'),p_values->>'description',btrim(p_values->>'url'),auth.uid(),actor_name) returning id into result_id;
  else
    select * into previous from public."AD_deliverables" where id=p_deliverable and team_id=p_team for update;
    if not found or previous.updated_at is distinct from p_version then raise exception 'Deliverable changed' using errcode='40001';end if;
    update public."AD_deliverables" set category=p_values->>'category',title=btrim(p_values->>'title'),description=p_values->>'description',url=btrim(p_values->>'url'),
      submitted_by=auth.uid(),submitted_name=actor_name,submitted_at=clock_timestamp() where id=p_deliverable returning id into result_id;
  end if;
  return result_id;
end;
$$;
create function public."AD_delete_deliverable"(p_team uuid,p_deliverable uuid,p_version timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_deliverables"%rowtype;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password) then
    raise exception 'Current student membership required' using errcode='42501';
  end if;
  select * into previous from public."AD_deliverables" where id=p_deliverable and team_id=p_team for update;
  if not found or previous.updated_at is distinct from p_version then raise exception 'Deliverable changed' using errcode='40001';end if;
  delete from public."AD_deliverables" where id=p_deliverable;
end;
$$;
revoke all on function public."AD_save_deliverable"(uuid,uuid,timestamptz,jsonb),public."AD_delete_deliverable"(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_save_deliverable"(uuid,uuid,timestamptz,jsonb),public."AD_delete_deliverable"(uuid,uuid,timestamptz) to authenticated;
commit;
