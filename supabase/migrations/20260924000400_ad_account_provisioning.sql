begin;
alter table public."AD_profiles" add column must_change_password boolean not null default false;

-- Never expose shared Auth account enumeration to a browser.
create function public."AD_find_auth_user"(p_email text)
returns uuid language sql security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function public."AD_find_auth_user"(text) from public, anon, authenticated;
grant execute on function public."AD_find_auth_user"(text) to service_role;

create function public."AD_link_participant_account"(p_participant uuid, p_user uuid, p_actor uuid, p_email text, p_version timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare participant public."AD_participants"%rowtype; auth_email text; managed boolean; app_profile public."AD_profiles"%rowtype;
begin
  if not exists (select 1 from public."AD_profiles" where id = p_actor and role = 'professor' and is_active and not must_change_password) then
    raise exception 'Professor permission required' using errcode = '42501';
  end if;
  select * into strict participant from public."AD_participants" where id = p_participant for update;
  if participant.status <> 'active' or participant.email <> p_email or participant.updated_at <> p_version then
    raise exception 'Participant changed; reload before provisioning' using errcode = '40001';
  end if;
  select email, coalesce((raw_app_meta_data->>'ad_lab_created') = 'true', false) into strict auth_email, managed from auth.users where id = p_user;
  if lower(auth_email) <> participant.email then raise exception 'Account email mismatch' using errcode = '23514'; end if;
  if participant.profile_id is not null and participant.profile_id <> p_user then raise exception 'Already linked to a different account' using errcode = '23514'; end if;
  insert into public."AD_profiles" (id, display_name, phone, role, must_change_password)
    values (p_user, participant.full_name, participant.phone, 'student', managed)
    on conflict (id) do nothing;
  select * into strict app_profile from public."AD_profiles" where id = p_user;
  if app_profile.role <> 'student' or not app_profile.is_active then
    raise exception 'Existing app role or inactive profile must not be overwritten' using errcode = '42501';
  end if;
  update public."AD_participants" set profile_id = p_user where id = participant.id;
  return p_user;
end;
$$;
revoke all on function public."AD_link_participant_account"(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public."AD_link_participant_account"(uuid, uuid, uuid, text, timestamptz) to service_role;

-- A linked email identifies a shared Auth account; do not silently relabel it.
create function public."AD_guard_linked_participant_email"()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.profile_id is not null and new.email <> old.email then
    raise exception 'Linked account email cannot be changed here' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public."AD_guard_linked_participant_email"() from public, anon, authenticated;
create trigger "AD_participants_linked_email" before update on public."AD_participants"
for each row execute function public."AD_guard_linked_participant_email"();

-- Students see only their active participation after the initial password change.
create policy "AD_participants_student_self" on public."AD_participants"
for select to authenticated using (
  profile_id = (select auth.uid()) and status = 'active' and exists (
    select 1 from public."AD_profiles" p where p.id = (select auth.uid()) and p.role = 'student' and p.is_active and not p.must_change_password
  )
);
create policy "AD_cohorts_student_membership" on public."AD_cohorts"
for select to authenticated using (exists (
  select 1 from public."AD_participants" a where a.cohort_id = "AD_cohorts".id and a.profile_id = (select auth.uid()) and a.status = 'active'
));
commit;
