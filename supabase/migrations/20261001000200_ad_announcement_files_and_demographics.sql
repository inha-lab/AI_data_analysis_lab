begin;

alter table public."AD_announcements"
  add column file_path text unique,
  add column file_name text,
  add column file_size bigint,
  add column file_type text;
alter table public."AD_announcements" add constraint "AD_announcements_file_check" check (
  (file_path is null and file_name is null and file_size is null and file_type is null)
  or (file_path like cohort_id::text||'/%' and char_length(file_path)<=500 and char_length(file_name) between 1 and 255
    and file_size between 1 and 20971520 and char_length(file_type) between 1 and 150)
);

insert into storage.buckets(id,name,public,file_size_limit)
values('AD_announcements','AD_announcements',false,20971520)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

create function public."AD_storage_cohort_id"(p_name text) returns uuid
language sql immutable set search_path='' as $$
  select case when split_part(p_name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_name,'/',1)::uuid else null::uuid end;
$$;
create function public."AD_can_read_announcement_file"(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select public."AD_is_team_professor"() or exists(
    select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
    where a.cohort_id=public."AD_storage_cohort_id"(p_name) and p.id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password
  );
$$;
revoke all on function public."AD_storage_cohort_id"(text),public."AD_can_read_announcement_file"(text) from public,anon;
grant execute on function public."AD_storage_cohort_id"(text),public."AD_can_read_announcement_file"(text) to authenticated;

create policy "AD_announcement_files_read" on storage.objects for select to authenticated using (
  bucket_id='AD_announcements' and public."AD_can_read_announcement_file"(name)
);
create policy "AD_announcement_files_insert" on storage.objects for insert to authenticated with check (
  bucket_id='AD_announcements' and public."AD_is_team_professor"()
  and lower(storage.extension(name)) in ('pdf','ppt','pptx','doc','docx','xls','xlsx','hwp','hwpx','zip','jpg','jpeg','png')
);
create policy "AD_announcement_files_delete" on storage.objects for delete to authenticated using (
  bucket_id='AD_announcements' and public."AD_is_team_professor"()
);

drop function public."AD_save_announcement"(uuid,uuid,timestamptz,text,text,boolean);
create function public."AD_save_announcement"(p_cohort uuid,p_announcement uuid,p_version timestamptz,p_title text,p_body text,p_pinned boolean,p_file_path text,p_file_name text,p_file_size bigint,p_file_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_announcements"%rowtype; actor_name text; result_id uuid;
begin
  if not public."AD_is_team_professor"() then raise exception 'Manager permission required' using errcode='42501'; end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) or p_title is null or p_body is null or p_pinned is null
    or char_length(btrim(p_title)) not between 1 and 120 or char_length(btrim(p_body)) not between 1 and 10000 then raise exception 'Invalid announcement' using errcode='23514'; end if;
  if (p_file_path is null) <> (p_file_name is null) or (p_file_path is null) <> (p_file_size is null) or (p_file_path is null) <> (p_file_type is null) then raise exception 'Invalid attachment' using errcode='23514'; end if;
  if p_announcement is null then
    select coalesce(nullif(display_name,''),'관리자') into actor_name from public."AD_profiles" where id=auth.uid();
    insert into public."AD_announcements"(cohort_id,title,body,is_pinned,file_path,file_name,file_size,file_type,author_id,author_name)
      values(p_cohort,btrim(p_title),btrim(p_body),p_pinned,p_file_path,p_file_name,p_file_size,p_file_type,auth.uid(),actor_name) returning id into result_id;
  else
    select * into previous from public."AD_announcements" where id=p_announcement for update;
    if not found or previous.cohort_id<>p_cohort then raise exception 'Announcement not found' using errcode='23514'; end if;
    if previous.updated_at is distinct from p_version then raise exception 'Announcement changed' using errcode='40001'; end if;
    update public."AD_announcements" set title=btrim(p_title),body=btrim(p_body),is_pinned=p_pinned,file_path=p_file_path,file_name=p_file_name,file_size=p_file_size,file_type=p_file_type,updated_at=clock_timestamp()
      where id=p_announcement returning id into result_id;
  end if;
  return result_id;
end;
$$;
revoke all on function public."AD_save_announcement"(uuid,uuid,timestamptz,text,text,boolean,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public."AD_save_announcement"(uuid,uuid,timestamptz,text,text,boolean,text,text,bigint,text) to authenticated;

create function public."AD_program_demographics"(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Manager permission required' using errcode='42501'; end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) then raise exception 'Program not found' using errcode='22023'; end if;
  with participants as (
    select department,grade,gender from public."AD_participants" where cohort_id=p_cohort and status='active'
  ), departments as (
    select department as label,count(*)::integer as count from participants group by department
  ), grades as (
    select grade as label,count(*)::integer as total,count(*) filter(where gender='male')::integer as male,
      count(*) filter(where gender='female')::integer as female,count(*) filter(where gender='unspecified')::integer as unspecified
    from participants group by grade
  ), genders as (
    select value as label,(select count(*) from participants where gender=value)::integer as count
    from unnest(array['male','female','unspecified']) value
  )
  select jsonb_build_object(
    'departments',coalesce((select jsonb_agg(to_jsonb(d) order by count desc,label) from departments d),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(to_jsonb(g) order by label) from grades g),'[]'::jsonb),
    'genders',coalesce((select jsonb_agg(to_jsonb(g)) from genders g),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public."AD_program_demographics"(uuid) from public,anon,authenticated;
grant execute on function public."AD_program_demographics"(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
