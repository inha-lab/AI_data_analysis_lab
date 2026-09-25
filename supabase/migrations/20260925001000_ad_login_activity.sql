begin;
create table public."AD_login_activities" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."AD_profiles"(id) on delete restrict,
  signed_in_at timestamptz not null,
  device_type text not null check(device_type in ('desktop','mobile','tablet','unknown')),
  browser_name text not null check(browser_name in ('Chrome','Edge','Safari','Firefox','Other')),
  recorded_at timestamptz not null default clock_timestamp(),
  unique(user_id,signed_in_at)
);
create index "AD_login_activities_user_time" on public."AD_login_activities"(user_id,signed_in_at desc);
alter table public."AD_login_activities" enable row level security;
revoke all on public."AD_login_activities" from anon,authenticated;
grant all on public."AD_login_activities" to service_role;

create function public."AD_record_login_activity"(p_device text,p_browser text)
returns void language plpgsql security definer set search_path='' as $$
declare login_at timestamptz;
begin
  if not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active) then
    raise exception 'Active student required' using errcode='42501';
  end if;
  if p_device not in ('desktop','mobile','tablet','unknown') or p_browser not in ('Chrome','Edge','Safari','Firefox','Other') or p_device is null or p_browser is null then
    raise exception 'Invalid device' using errcode='23514';
  end if;
  select last_sign_in_at into login_at from auth.users where id=auth.uid();
  if login_at is null or login_at<clock_timestamp()-interval '2 minutes' or login_at>clock_timestamp()+interval '30 seconds' then
    raise exception 'Recent login required' using errcode='42501';
  end if;
  insert into public."AD_login_activities"(user_id,signed_in_at,device_type,browser_name)
    values(auth.uid(),login_at,p_device,p_browser) on conflict(user_id,signed_in_at) do nothing;
end;
$$;
create function public."AD_program_login_activity"(p_cohort uuid,p_since timestamptz default null)
returns table(participant_id uuid,full_name text,student_number text,email text,device_type text,browser_name text,signed_in_at timestamptz,last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='professor' and is_active and not must_change_password) then
    raise exception 'Professor permission required' using errcode='42501';
  end if;
  return query
    select p.id,p.full_name,p.student_number,p.email,l.device_type,l.browser_name,l.signed_in_at,
      (select max(latest.signed_in_at) from public."AD_login_activities" latest where latest.user_id=p.profile_id)
    from public."AD_participants" p join public."AD_login_activities" l on l.user_id=p.profile_id
    where p.cohort_id=p_cohort and (p_since is null or l.signed_in_at>=p_since)
    order by l.signed_in_at desc,l.id desc;
end;
$$;
revoke all on function public."AD_record_login_activity"(text,text),public."AD_program_login_activity"(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_record_login_activity"(text,text),public."AD_program_login_activity"(uuid,timestamptz) to authenticated;
commit;
