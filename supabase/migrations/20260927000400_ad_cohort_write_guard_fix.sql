begin;
create or replace function public."AD_guard_student_cohort_write"() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_cohort uuid; v_status text;
begin
  if not exists(select 1 from public."AD_profiles" p where p.id=auth.uid() and p.role='student') then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='AD_teams' then v_cohort:=case when tg_op='DELETE' then old.cohort_id else new.cohort_id end;
  elsif tg_table_name='AD_gpu_reservations' then v_cohort:=case when tg_op='DELETE' then old.cohort_id else new.cohort_id end;
  elsif tg_table_name='AD_team_members' then select cohort_id into v_cohort from public."AD_teams" where id=case when tg_op='DELETE' then old.team_id else new.team_id end;
  else select t.cohort_id into v_cohort from public."AD_teams" t where t.id=case when tg_op='DELETE' then old.team_id else new.team_id end; end if;
  select status into v_status from public."AD_cohorts" where id=v_cohort;
  if v_status is distinct from 'active' then raise exception '운영 중인 프로그램에서만 등록하거나 수정할 수 있습니다.' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
commit;
