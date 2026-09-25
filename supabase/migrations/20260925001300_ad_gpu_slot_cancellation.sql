begin;
create function public."AD_cancel_gpu_reservation_slot"(p_reservation uuid,p_gpu smallint,p_day date,p_hour smallint)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_gpu_reservations"%rowtype; slot_start timestamptz; slot_end timestamptz; gpu smallint;
begin
  if p_gpu is null or p_gpu not in (0,1) or p_day is null or not isfinite(p_day) or p_hour is null or p_hour not between 0 and 23 then
    raise exception 'Invalid GPU hour' using errcode='23514';
  end if;
  select * into previous from public."AD_gpu_reservations" where id=p_reservation for update;
  if not found or previous.status<>'active' then raise exception 'Active reservation not found' using errcode='23514';end if;
  if not public."AD_is_team_professor"() and not public."AD_can_read_team"(previous.team_id) then
    raise exception 'Team permission required' using errcode='42501';end if;
  slot_start:=(p_day+make_time(p_hour,0,0)) at time zone 'Asia/Seoul';
  slot_end:=slot_start+interval '1 hour';
  if not p_gpu=any(previous.gpu_ids) or previous.starts_at>=slot_end or previous.ends_at<=slot_start then
    raise exception 'GPU hour is not reserved' using errcode='23514';end if;
  foreach gpu in array previous.gpu_ids loop
    perform pg_advisory_xact_lock(913570,gpu::integer);
  end loop;
  update public."AD_gpu_reservations" set status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=auth.uid() where id=p_reservation;
  if cardinality(previous.gpu_ids)=2 then
    insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by,created_at)
      values(previous.cohort_id,previous.team_id,array[1-p_gpu]::smallint[],previous.starts_at,previous.ends_at,previous.purpose,previous.requested_by,previous.created_at);
  end if;
  if previous.starts_at<slot_start then
    insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by,created_at)
      values(previous.cohort_id,previous.team_id,array[p_gpu]::smallint[],previous.starts_at,slot_start,previous.purpose,previous.requested_by,previous.created_at);
  end if;
  if previous.ends_at>slot_end then
    insert into public."AD_gpu_reservations"(cohort_id,team_id,gpu_ids,starts_at,ends_at,purpose,requested_by,created_at)
      values(previous.cohort_id,previous.team_id,array[p_gpu]::smallint[],slot_end,previous.ends_at,previous.purpose,previous.requested_by,previous.created_at);
  end if;
end;
$$;
revoke execute on function public."AD_cancel_gpu_reservation"(uuid) from public,anon,authenticated;
revoke all on function public."AD_cancel_gpu_reservation_slot"(uuid,smallint,date,smallint) from public,anon,authenticated;
grant execute on function public."AD_cancel_gpu_reservation_slot"(uuid,smallint,date,smallint) to authenticated;
notify pgrst,'reload schema';
commit;
