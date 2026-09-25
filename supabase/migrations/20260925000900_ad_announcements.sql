begin;
create table public."AD_announcements" (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public."AD_cohorts"(id) on delete restrict,
  title text not null check(title=btrim(title) and char_length(title) between 1 and 120),
  body text not null check(body=btrim(body) and char_length(body) between 1 and 10000),
  is_pinned boolean not null default false,
  author_id uuid not null references public."AD_profiles"(id) on delete restrict,
  author_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index "AD_announcements_cohort_order" on public."AD_announcements"(cohort_id,is_pinned desc,created_at desc,id desc);
alter table public."AD_announcements" enable row level security;
revoke all on public."AD_announcements" from anon,authenticated;
grant select on public."AD_announcements" to authenticated;
grant all on public."AD_announcements" to service_role;
create policy "AD_announcements_read" on public."AD_announcements" for select to authenticated using (
  exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role='professor' and p.is_active and not p.must_change_password)
  or exists(select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
    where a.cohort_id="AD_announcements".cohort_id and a.profile_id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password)
);
create function public."AD_save_announcement"(p_cohort uuid,p_announcement uuid,p_version timestamptz,p_title text,p_body text,p_pinned boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public."AD_announcements"%rowtype; actor_name text; result_id uuid;
begin
  if not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='professor' and is_active and not must_change_password) then
    raise exception 'Professor permission required' using errcode='42501';
  end if;
  if not exists(select 1 from public."AD_cohorts" where id=p_cohort) or p_title is null or p_body is null or p_pinned is null
    or char_length(btrim(p_title)) not between 1 and 120 or char_length(btrim(p_body)) not between 1 and 10000 then
    raise exception 'Invalid announcement' using errcode='23514';
  end if;
  if p_announcement is null then
    select coalesce(nullif(display_name,''),'교수') into actor_name from public."AD_profiles" where id=auth.uid();
    insert into public."AD_announcements"(cohort_id,title,body,is_pinned,author_id,author_name)
      values(p_cohort,btrim(p_title),btrim(p_body),p_pinned,auth.uid(),actor_name) returning id into result_id;
  else
    select * into previous from public."AD_announcements" where id=p_announcement for update;
    if not found or previous.cohort_id<>p_cohort then raise exception 'Announcement not found' using errcode='23514'; end if;
    if previous.updated_at is distinct from p_version then raise exception 'Announcement changed' using errcode='40001'; end if;
    update public."AD_announcements" set title=btrim(p_title),body=btrim(p_body),is_pinned=p_pinned,updated_at=clock_timestamp()
      where id=p_announcement returning id into result_id;
  end if;
  return result_id;
end;
$$;
create function public."AD_delete_announcement"(p_cohort uuid,p_announcement uuid,p_version timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_announcements"%rowtype;
begin
  if not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='professor' and is_active and not must_change_password) then
    raise exception 'Professor permission required' using errcode='42501';
  end if;
  select * into previous from public."AD_announcements" where id=p_announcement for update;
  if not found or previous.cohort_id<>p_cohort then raise exception 'Announcement not found' using errcode='23514'; end if;
  if previous.updated_at is distinct from p_version then raise exception 'Announcement changed' using errcode='40001'; end if;
  delete from public."AD_announcements" where id=p_announcement;
end;
$$;
revoke all on function public."AD_save_announcement"(uuid,uuid,timestamptz,text,text,boolean),public."AD_delete_announcement"(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_save_announcement"(uuid,uuid,timestamptz,text,text,boolean),public."AD_delete_announcement"(uuid,uuid,timestamptz) to authenticated;
commit;
