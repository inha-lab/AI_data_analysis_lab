begin;
alter table public."AD_gpu_reservations" add column application_id uuid;
-- Earlier hourly cancellations kept these immutable fields on every remainder row.
with grouped as (
  select id, min(id::text) over (partition by cohort_id,team_id,requested_by,created_at,purpose)::uuid as application_id
  from public."AD_gpu_reservations"
)
update public."AD_gpu_reservations" r set application_id=g.application_id from grouped g where r.id=g.id;
alter table public."AD_gpu_reservations" alter column application_id set default gen_random_uuid();
alter table public."AD_gpu_reservations" alter column application_id set not null;
create index "AD_gpu_reservations_application" on public."AD_gpu_reservations"(application_id) where status='active';

create function public."AD_gpu_application_list"(p_cohort uuid)
returns table(application_id uuid,team_id uuid,program_name text,team_name text,purpose text,requester_name text,starts_at timestamptz,ends_at timestamptz,segments jsonb,can_cancel boolean)
language plpgsql stable security definer set search_path='' as $$
declare professor boolean:=public."AD_is_team_professor"();
begin
  if p_cohort is null or not exists(select 1 from public."AD_cohorts" c where c.id=p_cohort) then
    raise exception 'Program required' using errcode='23514';end if;
  if not professor and not exists(
    select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
    where a.cohort_id=p_cohort and a.profile_id=auth.uid() and a.status='active' and p.role='student' and p.is_active and not p.must_change_password
  ) then raise exception 'Program membership required' using errcode='42501';end if;
  return query
  with active as (
    select r.application_id,min(r.starts_at) as first_at,max(r.ends_at) as last_at,
      jsonb_agg(jsonb_build_object('gpu_ids',r.gpu_ids,'starts_at',r.starts_at,'ends_at',r.ends_at) order by r.starts_at,r.id) as parts
    from public."AD_gpu_reservations" r where r.status='active' group by r.application_id
  )
  select a.application_id,
    case when professor or r.cohort_id=p_cohort then r.team_id else null::uuid end,
    case when professor or r.cohort_id=p_cohort then c.name else '다른 프로그램' end,
    case when professor or r.cohort_id=p_cohort then t.name else '다른 프로그램' end,
    case when professor or r.cohort_id=p_cohort then r.purpose else '예약 중' end,
    case when professor then p.display_name else null::text end,
    a.first_at,a.last_at,a.parts,
    (professor or (r.cohort_id=p_cohort and public."AD_can_read_team"(r.team_id)))
  from active a
  join lateral (select r.* from public."AD_gpu_reservations" r where r.application_id=a.application_id and r.status='active' order by r.id limit 1) r on true
  join public."AD_teams" t on t.id=r.team_id
  join public."AD_cohorts" c on c.id=r.cohort_id
  join public."AD_profiles" p on p.id=r.requested_by
  order by a.first_at desc,a.application_id;
end;
$$;

create function public."AD_cancel_gpu_application"(p_application uuid)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_gpu_reservations"%rowtype;
begin
  select * into previous from public."AD_gpu_reservations" where application_id=p_application and status='active' order by id limit 1 for update;
  if not found then raise exception 'Active application not found' using errcode='23514';end if;
  if not public."AD_is_team_professor"() and not public."AD_can_read_team"(previous.team_id) then
    raise exception 'Team permission required' using errcode='42501';end if;
  perform 1 from public."AD_gpu_reservations" where application_id=p_application and status='active' order by id for update;
  perform pg_advisory_xact_lock(913570,0);
  perform pg_advisory_xact_lock(913570,1);
  update public."AD_gpu_reservations" set status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=auth.uid()
    where application_id=p_application and status='active';
end;
$$;
revoke execute on function public."AD_cancel_gpu_reservation_slot"(uuid,smallint,date,smallint) from public,anon,authenticated;
revoke all on function public."AD_gpu_application_list"(uuid),public."AD_cancel_gpu_application"(uuid) from public,anon,authenticated;
grant execute on function public."AD_gpu_application_list"(uuid),public."AD_cancel_gpu_application"(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
