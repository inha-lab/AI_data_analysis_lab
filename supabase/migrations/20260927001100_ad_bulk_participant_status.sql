begin;

create function public."AD_bulk_update_participant_status"(p_cohort uuid,p_participants uuid[],p_status text)
returns integer language plpgsql security definer set search_path='' as $$
declare requested_count integer; changed_count integer;
begin
  if not exists(select 1 from public."AD_profiles" p where p.id=auth.uid() and p.role in ('professor','admin') and p.is_active and not p.must_change_password) then
    raise exception 'Manager permission required' using errcode='42501';
  end if;
  if p_status not in ('active','completed','dropout','inactive') then raise exception 'Invalid participant status' using errcode='23514';end if;
  requested_count:=coalesce(array_length(p_participants,1),0);
  if requested_count not between 1 and 500 or requested_count<>(select count(distinct participant_id) from unnest(p_participants) as selected(participant_id)) then
    raise exception 'Invalid participant selection' using errcode='23514';
  end if;
  perform 1 from public."AD_cohorts" where id=p_cohort for update;
  if not found then raise exception 'Program not found' using errcode='23503';end if;
  perform 1 from public."AD_participants" where cohort_id=p_cohort and id=any(p_participants) for update;
  if (select count(*) from public."AD_participants" where cohort_id=p_cohort and id=any(p_participants))<>requested_count then
    raise exception 'Participant selection changed' using errcode='40001';
  end if;
  update public."AD_participants" set status=p_status where cohort_id=p_cohort and id=any(p_participants);
  get diagnostics changed_count=row_count;
  return changed_count;
end;
$$;
revoke all on function public."AD_bulk_update_participant_status"(uuid,uuid[],text) from public,anon;
grant execute on function public."AD_bulk_update_participant_status"(uuid,uuid[],text) to authenticated;

notify pgrst,'reload schema';
commit;
