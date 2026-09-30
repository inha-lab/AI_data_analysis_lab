begin;

create or replace function public."AD_update_participant"(
  p_participant uuid,
  p_cohort uuid,
  p_version timestamptz,
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
  previous public."AD_participants";
  changed public."AD_participants";
begin
  if not public."AD_is_team_professor"() then
    raise exception 'Manager permission required' using errcode = '42501';
  end if;

  select * into previous from public."AD_participants"
  where id = p_participant and cohort_id = p_cohort for update;
  if not found then
    raise exception 'Participant not found' using errcode = 'P0002';
  end if;
  if previous.updated_at <> p_version then
    raise exception 'Participant changed' using errcode = '40001';
  end if;
  if previous.profile_id is not null and previous.email <> p_email then
    raise exception 'Linked email cannot change' using errcode = '23514';
  end if;

  update public."AD_participants" set
    full_name = p_full_name,
    email = p_email,
    department = p_department,
    student_number = p_student_number,
    grade = p_grade,
    gender = p_gender,
    phone = p_phone,
    job_group = p_job_group,
    job_group_other = p_job_group_other,
    status = p_status
  where id = p_participant
  returning * into changed;

  return changed;
end;
$$;

revoke all on function public."AD_update_participant"(uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public."AD_update_participant"(uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) to authenticated;

commit;
