begin;

create or replace function public."AD_student_can_read_cohort"(p_cohort uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public."AD_participants" a
      join public."AD_profiles" p on p.id=a.profile_id
      join public."AD_cohorts" c on c.id=a.cohort_id
    where a.cohort_id=p_cohort and a.profile_id=(select auth.uid()) and a.status='active'
      and p.role='student' and p.is_active and not p.must_change_password
      and c.status in ('active','completed')
  );
$$;
revoke all on function public."AD_student_can_read_cohort"(uuid) from public,anon;
grant execute on function public."AD_student_can_read_cohort"(uuid) to authenticated;

drop policy "AD_cohorts_student_membership" on public."AD_cohorts";
create policy "AD_cohorts_student_membership" on public."AD_cohorts" for select to authenticated
using (public."AD_student_can_read_cohort"(id));

drop policy "AD_participants_student_self" on public."AD_participants";
create policy "AD_participants_student_self" on public."AD_participants" for select to authenticated
using (profile_id=(select auth.uid()) and status='active' and public."AD_student_can_read_cohort"(cohort_id));

commit;
