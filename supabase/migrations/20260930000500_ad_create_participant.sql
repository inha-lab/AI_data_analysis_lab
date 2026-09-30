begin;

create or replace function public."AD_create_participant"(
  p_cohort uuid,
  p_full_name text,
  p_email text,
  p_department text,
  p_student_number text,
  p_grade text,
  p_gender text,
  p_phone text,
  p_job_group text,
  p_job_group_other text,
  p_status text
) returns public."AD_participants"
language plpgsql security definer set search_path = '' as $$
declare
  created public."AD_participants";
begin
  if not public."AD_is_team_professor"() then
    raise exception 'Manager permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public."AD_cohorts" where id = p_cohort) then
    raise exception 'Program not found' using errcode = '23503';
  end if;

  insert into public."AD_participants" (
    cohort_id, profile_id, full_name, email, department, student_number,
    grade, gender, phone, job_group, job_group_other, status, created_by
  ) values (
    p_cohort, null, p_full_name, p_email, p_department, p_student_number,
    p_grade, p_gender, p_phone, p_job_group, p_job_group_other, p_status, auth.uid()
  ) returning * into created;

  return created;
end;
$$;

revoke all on function public."AD_create_participant"(uuid,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public."AD_create_participant"(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;

commit;
