begin;

-- Both administrator roles retain full access regardless of program lifecycle state.
create or replace function public."AD_is_team_professor"() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public."AD_profiles" p
    where p.id=(select auth.uid()) and p.role in ('professor','admin')
      and p.is_active and not p.must_change_password
  );
$$;
revoke all on function public."AD_is_team_professor"() from public,anon;
grant execute on function public."AD_is_team_professor"() to authenticated;

-- Make the direct table policies explicit instead of depending on earlier policy rewrites.
drop policy "AD_cohorts_professor_select" on public."AD_cohorts";
create policy "AD_cohorts_professor_select" on public."AD_cohorts" for select to authenticated using (
  exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active)
);

drop policy "AD_participants_professor_select" on public."AD_participants";
create policy "AD_participants_professor_select" on public."AD_participants" for select to authenticated using (
  exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active)
);

drop policy "AD_schedules_professor_select" on public."AD_schedules";
create policy "AD_schedules_professor_select" on public."AD_schedules" for select to authenticated using (
  exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password)
);

commit;
