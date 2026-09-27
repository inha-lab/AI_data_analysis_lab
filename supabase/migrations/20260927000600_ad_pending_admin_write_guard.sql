begin;

drop policy "AD_cohorts_professor_insert" on public."AD_cohorts";
create policy "AD_cohorts_professor_insert" on public."AD_cohorts" for insert to authenticated with check (
  created_by=(select auth.uid()) and exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password)
);
drop policy "AD_cohorts_professor_update" on public."AD_cohorts";
create policy "AD_cohorts_professor_update" on public."AD_cohorts" for update to authenticated
using (exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password))
with check (exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password));

drop policy "AD_participants_professor_insert" on public."AD_participants";
create policy "AD_participants_professor_insert" on public."AD_participants" for insert to authenticated with check (
  created_by=(select auth.uid()) and profile_id is null and exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password)
);
drop policy "AD_participants_professor_update" on public."AD_participants";
create policy "AD_participants_professor_update" on public."AD_participants" for update to authenticated
using (exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password))
with check (exists(select 1 from public."AD_profiles" p where p.id=(select auth.uid()) and p.role in ('professor','admin') and p.is_active and not p.must_change_password));

commit;
