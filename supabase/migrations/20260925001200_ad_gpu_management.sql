begin;
create or replace function public."AD_save_gpu_reservation"(p_team uuid,p_day date,p_start time,p_end time,p_gpu_ids smallint[],p_purpose text)
returns uuid language plpgsql security definer set search_path='' as $$
declare team public."AD_teams"%rowtype; start_at timestamptz; end_at timestamptz; gpu smallint; result_id uuid;
begin
  select * into team from public."AD_teams" where id=p_team for share;
  if not found or not (
    public."AD_is_team_professor"() or (
      exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password)
      and public."AD_can_read_team"(p_team)
    )
  ) then raise exception 'Team reservation permission required' using errcode='42501';end if;
  if p_day is null or p_start is null or p_end is null or p_purpose is null or char_length(btrim(p_purpose)) not between 1 and 500
    or p_gpu_ids is null or not (p_gpu_ids=array[0]::smallint[] or p_gpu_ids=array[1]::smallint[] or p_gpu_ids=array[0,1]::smallint[])
    or extract(minute from p_start)<>0 or extract(second from p_start)<>0
    or extract(minute from p_end)<>0 or extract(second from p_end)<>0 then
    raise exception 'Invalid hourly reservation' using errcode='23514';end if;
  start_at:=(p_day+p_start) at time zone 'Asia/Seoul';
  end_at:=(p_day+p_end+case when p_end<=p_start then interval '1 day' else interval '0 days' end) at time zone 'Asia/Seoul';
  if end_at<=start_at or end_at>start_at+interval '24 hours' then raise exception 'Invalid reservation window' using errcode='23514';end if;
  foreach gpu in array p_gpu_ids loop
    perform pg_advisory_xact_lock(913570,gpu::integer);
  end loop;
  if exists(select 1 from public."AD_gpu_reservations" r where r.status='active' and r.starts_at<end_at and r.ends_at>start_at and r.gpu_ids&&p_gpu_ids) then
    raise exception 'GPU already reserved' using errcode='23P01';end if;
  insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by)
    values(team.cohort_id,p_team,p_gpu_ids,start_at,end_at,btrim(p_purpose),auth.uid()) returning id into result_id;
  return result_id;
end;
$$;

create function public."AD_gpu_day_schedule_v2"(p_cohort uuid,p_day date)
returns table(id uuid,team_id uuid,program_name text,team_name text,gpu_ids smallint[],starts_at timestamptz,ends_at timestamptz,purpose text,can_cancel boolean,requester_name text)
language sql stable security definer set search_path='' as $$
  select s.id,s.team_id,s.program_name,s.team_name,s.gpu_ids,s.starts_at,s.ends_at,s.purpose,s.can_cancel,
    case when public."AD_is_team_professor"() then coalesce(nullif(p.display_name,''),'이름 미등록') else null end
  from public."AD_gpu_day_schedule"(p_cohort,p_day) s
    join public."AD_gpu_reservations" r on r.id=s.id
    join public."AD_profiles" p on p.id=r.requested_by;
$$;
revoke all on function public."AD_gpu_day_schedule_v2"(uuid,date) from public,anon,authenticated;
grant execute on function public."AD_gpu_day_schedule_v2"(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
