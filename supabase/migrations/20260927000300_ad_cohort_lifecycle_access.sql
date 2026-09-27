begin;

-- Students can discover only running and completed programs in which they participate.
drop policy "AD_cohorts_student_membership" on public."AD_cohorts";
create policy "AD_cohorts_student_membership" on public."AD_cohorts" for select to authenticated using (
  status in ('active','completed') and exists (
    select 1 from public."AD_participants" a where a.cohort_id="AD_cohorts".id and a.profile_id=(select auth.uid()) and a.status='active'
  )
);

drop policy "AD_participants_student_self" on public."AD_participants";
create policy "AD_participants_student_self" on public."AD_participants" for select to authenticated using (
  profile_id=(select auth.uid()) and status='active'
  and exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role='student' and p.is_active and not p.must_change_password)
  and exists(select 1 from public."AD_cohorts" c where c.id=cohort_id and c.status in ('active','completed'))
);

drop policy "AD_schedules_student_membership" on public."AD_schedules";
create policy "AD_schedules_student_membership" on public."AD_schedules" for select to authenticated using (
  exists(select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
    join public."AD_cohorts" c on c.id=a.cohort_id
    where a.cohort_id="AD_schedules".cohort_id and a.profile_id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password and c.status in ('active','completed'))
);

drop policy "AD_announcements_read" on public."AD_announcements";
create policy "AD_announcements_read" on public."AD_announcements" for select to authenticated using (
  public."AD_is_team_professor"() or exists(
    select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
      join public."AD_cohorts" c on c.id=a.cohort_id
    where a.cohort_id="AD_announcements".cohort_id and a.profile_id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password and c.status in ('active','completed'))
);

create or replace function public."AD_can_read_team"(p_team uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public."AD_is_team_professor"() or exists(
    select 1 from public."AD_team_members" m join public."AD_participants" a on a.id=m.participant_id
      join public."AD_profiles" p on p.id=a.profile_id join public."AD_teams" t on t.id=m.team_id
      join public."AD_cohorts" c on c.id=t.cohort_id
    where m.team_id=p_team and p.id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password and c.status in ('active','completed'));
$$;

create or replace function public."AD_guard_student_cohort_write"() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_cohort uuid; v_status text;
begin
  if not exists(select 1 from public."AD_profiles" p where p.id=auth.uid() and p.role='student') then return coalesce(new,old); end if;
  if tg_table_name='AD_teams' then v_cohort:=coalesce(new.cohort_id,old.cohort_id);
  elsif tg_table_name='AD_gpu_reservations' then v_cohort:=coalesce(new.cohort_id,old.cohort_id);
  elsif tg_table_name='AD_team_members' then select cohort_id into v_cohort from public."AD_teams" where id=coalesce(new.team_id,old.team_id);
  else select t.cohort_id into v_cohort from public."AD_teams" t where t.id=coalesce(new.team_id,old.team_id); end if;
  select status into v_status from public."AD_cohorts" where id=v_cohort;
  if v_status is distinct from 'active' then raise exception '운영 중인 프로그램에서만 등록하거나 수정할 수 있습니다.' using errcode='42501'; end if;
  return coalesce(new,old);
end $$;
revoke all on function public."AD_guard_student_cohort_write"() from public,anon,authenticated;

create trigger "AD_teams_student_active_program" before insert or update or delete on public."AD_teams" for each row execute function public."AD_guard_student_cohort_write"();
create trigger "AD_team_members_student_active_program" before insert or update or delete on public."AD_team_members" for each row execute function public."AD_guard_student_cohort_write"();
create trigger "AD_proposals_student_active_program" before insert or update or delete on public."AD_proposals" for each row execute function public."AD_guard_student_cohort_write"();
create trigger "AD_reports_student_active_program" before insert or update or delete on public."AD_reports" for each row execute function public."AD_guard_student_cohort_write"();
create trigger "AD_deliverables_student_active_program" before insert or update or delete on public."AD_deliverables" for each row execute function public."AD_guard_student_cohort_write"();
create trigger "AD_gpu_student_active_program" before insert or update or delete on public."AD_gpu_reservations" for each row execute function public."AD_guard_student_cohort_write"();

create or replace function public."AD_public_schedules"()
returns table(id uuid,cohort_id uuid,program_name text,title text,description text,stage text,kind text,starts_at timestamptz,ends_at timestamptz,is_cancelled boolean)
language sql stable security definer set search_path='' as $$
  select s.id,s.cohort_id,c.name,s.title,s.description,s.stage,s.kind,s.starts_at,s.ends_at,s.is_cancelled
  from public."AD_schedules" s join public."AD_cohorts" c on c.id=s.cohort_id
  where s.is_public and c.status='active' order by s.starts_at,s.id;
$$;

commit;
