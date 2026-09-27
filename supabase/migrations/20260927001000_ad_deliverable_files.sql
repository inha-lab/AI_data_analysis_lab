begin;

alter table public."AD_deliverables" alter column url drop not null;
alter table public."AD_deliverables" alter column url set default '';
alter table public."AD_deliverables" drop constraint "AD_deliverables_url_check";
alter table public."AD_deliverables" add constraint "AD_deliverables_url_check"
  check (url is not null and (url='' or (char_length(url)<=2000 and public."AD_team_url_valid"(url))));
alter table public."AD_deliverables"
  add column file_path text unique,
  add column file_name text,
  add column file_size bigint,
  add column file_type text;
alter table public."AD_deliverables" add constraint "AD_deliverables_file_check" check (
  (file_path is null and file_name is null and file_size is null and file_type is null)
  or (file_path is not null and file_path like team_id::text||'/%' and char_length(file_path)<=500
    and file_name is not null and char_length(file_name) between 1 and 255
    and file_size between 1 and 20971520
    and file_type in ('application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'))
);
alter table public."AD_deliverables" add constraint "AD_deliverables_source_check" check (url<>'' or file_path is not null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('AD_deliverables','AD_deliverables',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public."AD_storage_team_id"(p_name text) returns uuid
language sql immutable set search_path='' as $$
  select case when split_part(p_name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_name,'/',1)::uuid else null::uuid end;
$$;
create function public."AD_can_write_team_file"(p_team uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public."AD_team_members" m
    join public."AD_participants" a on a.id=m.participant_id
    join public."AD_profiles" p on p.id=a.profile_id
    join public."AD_teams" t on t.id=m.team_id
    join public."AD_cohorts" c on c.id=t.cohort_id
    where m.team_id=p_team and p.id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password and c.status='active');
$$;
revoke all on function public."AD_storage_team_id"(text),public."AD_can_write_team_file"(uuid) from public,anon;
grant execute on function public."AD_storage_team_id"(text),public."AD_can_write_team_file"(uuid) to authenticated;

create policy "AD_deliverable_files_read" on storage.objects for select to authenticated using (
  bucket_id='AD_deliverables' and public."AD_can_read_team"(public."AD_storage_team_id"(name))
);
create policy "AD_deliverable_files_insert" on storage.objects for insert to authenticated with check (
  bucket_id='AD_deliverables' and public."AD_can_write_team_file"(public."AD_storage_team_id"(name))
  and lower(storage.extension(name)) in ('pdf','pptx','zip')
);
create policy "AD_deliverable_files_delete" on storage.objects for delete to authenticated using (
  bucket_id='AD_deliverables' and public."AD_can_write_team_file"(public."AD_storage_team_id"(name))
);

create or replace function public."AD_save_deliverable"(p_team uuid,p_deliverable uuid,p_version timestamptz,p_values jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_deliverables"%rowtype; actor_name text; result_id uuid; field text;
begin
  perform 1 from public."AD_teams" where id=p_team for update;
  if not found or not public."AD_can_read_team"(p_team) or not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password) then
    raise exception 'Current student membership required' using errcode='42501';
  end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' or (select count(*) from jsonb_object_keys(p_values))<>8 then raise exception 'Invalid fields' using errcode='23514';end if;
  foreach field in array array['category','title','description','url'] loop
    if jsonb_typeof(p_values->field) is distinct from 'string' then raise exception 'Missing text field' using errcode='23514';end if;
  end loop;
  if (p_values->'file_path'<>'null'::jsonb and jsonb_typeof(p_values->'file_path')<>'string')
    or (p_values->'file_name'<>'null'::jsonb and jsonb_typeof(p_values->'file_name')<>'string')
    or (p_values->'file_size'<>'null'::jsonb and jsonb_typeof(p_values->'file_size')<>'number')
    or (p_values->'file_type'<>'null'::jsonb and jsonb_typeof(p_values->'file_type')<>'string') then raise exception 'Invalid file fields' using errcode='23514';end if;
  select coalesce(nullif(display_name,''),'학생') into actor_name from public."AD_profiles" where id=auth.uid();
  if p_deliverable is null then
    insert into public."AD_deliverables"(team_id,category,title,description,url,file_path,file_name,file_size,file_type,submitted_by,submitted_name)
      values(p_team,p_values->>'category',btrim(p_values->>'title'),p_values->>'description',btrim(p_values->>'url'),p_values->>'file_path',p_values->>'file_name',(p_values->>'file_size')::bigint,p_values->>'file_type',auth.uid(),actor_name) returning id into result_id;
  else
    select * into previous from public."AD_deliverables" where id=p_deliverable and team_id=p_team for update;
    if not found or previous.updated_at is distinct from p_version then raise exception 'Deliverable changed' using errcode='40001';end if;
    update public."AD_deliverables" set category=p_values->>'category',title=btrim(p_values->>'title'),description=p_values->>'description',url=btrim(p_values->>'url'),
      file_path=p_values->>'file_path',file_name=p_values->>'file_name',file_size=(p_values->>'file_size')::bigint,file_type=p_values->>'file_type',
      submitted_by=auth.uid(),submitted_name=actor_name,submitted_at=clock_timestamp() where id=p_deliverable returning id into result_id;
  end if;
  return result_id;
end;
$$;

create or replace function public."AD_program_deliverables"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501';end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then raise exception 'Program not found' using errcode='22023';end if;
  with groups as (
    select t.id,t.name,t.stage,
      (select count(*) from public."AD_deliverables" d where d.team_id=t.id) as item_count,
      (select max(d.submitted_at) from public."AD_deliverables" d where d.team_id=t.id) as latest_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'category',d.category,'title',d.title,'description',d.description,'url',d.url,'file_path',d.file_path,'file_name',d.file_name,'file_size',d.file_size,'file_type',d.file_type,'submitted_name',d.submitted_name,'submitted_at',d.submitted_at) order by d.submitted_at desc,d.id desc) from public."AD_deliverables" d where d.team_id=t.id),'[]'::jsonb) as items
    from public."AD_teams" t where t.cohort_id=p_cohort
  )
  select jsonb_build_object('team_count',(select count(*) from groups),'submitted_team_count',(select count(*) from groups where item_count>0),'deliverable_count',(select coalesce(sum(item_count),0) from groups),'groups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stage',stage,'item_count',item_count,'latest_at',latest_at,'items',items) order by latest_at desc nulls last,name,id) from groups),'[]'::jsonb)) into result;
  return result;
end;
$$;

notify pgrst,'reload schema';
commit;
