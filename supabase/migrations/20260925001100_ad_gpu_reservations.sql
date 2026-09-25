begin;
create table public."AD_gpu_reservations" (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public."AD_cohorts"(id) on delete restrict,
  team_id uuid not null,
  gpu_ids smallint[] not null check(gpu_ids=array[0]::smallint[] or gpu_ids=array[1]::smallint[] or gpu_ids=array[0,1]::smallint[]),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
  purpose text not null check(purpose=btrim(purpose) and char_length(purpose) between 1 and 500),
  requested_by uuid not null references public."AD_profiles"(id) on delete restrict,
  status text not null default 'active' check(status in ('active','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  cancelled_by uuid references public."AD_profiles"(id) on delete restrict,
  foreign key(team_id,cohort_id) references public."AD_teams"(id,cohort_id) on delete restrict,
  check((status='active' and cancelled_at is null and cancelled_by is null) or (status='cancelled' and cancelled_at is not null and cancelled_by is not null))
);
create index "AD_gpu_reservations_window" on public."AD_gpu_reservations"(starts_at,ends_at) where status='active';
create index "AD_gpu_reservations_team" on public."AD_gpu_reservations"(team_id,starts_at desc);
alter table public."AD_gpu_reservations" enable row level security;
revoke all on public."AD_gpu_reservations" from anon,authenticated;
grant all on public."AD_gpu_reservations" to service_role;

create function public."AD_gpu_day_schedule"(p_cohort uuid,p_day date)
returns table(id uuid,team_id uuid,program_name text,team_name text,gpu_ids smallint[],starts_at timestamptz,ends_at timestamptz,purpose text,can_cancel boolean)
language plpgsql stable security definer set search_path='' as $$
declare day_start timestamptz; day_end timestamptz;
begin
  if p_day is null or not exists(select 1 from public."AD_cohorts" where "AD_cohorts".id=p_cohort) then raise exception 'Program and date required' using errcode='23514';end if;
  if not public."AD_is_team_professor"() and not exists(
    select 1 from public."AD_participants" a join public."AD_profiles" p on p.id=a.profile_id
    where a.cohort_id=p_cohort and a.profile_id=auth.uid() and a.status='active' and p.role='student' and p.is_active and not p.must_change_password
  ) then raise exception 'Program membership required' using errcode='42501';end if;
  day_start:=p_day::timestamp at time zone 'Asia/Seoul';
  day_end:=(p_day+1)::timestamp at time zone 'Asia/Seoul';
  return query select r.id,
    case when r.cohort_id=p_cohort or public."AD_is_team_professor"() then r.team_id else null::uuid end,
    case when r.cohort_id=p_cohort or public."AD_is_team_professor"() then c.name else '다른 프로그램' end,
    case when r.cohort_id=p_cohort or public."AD_is_team_professor"() then t.name else '다른 프로그램' end,
    r.gpu_ids,r.starts_at,r.ends_at,
    case when r.cohort_id=p_cohort or public."AD_is_team_professor"() then r.purpose else '예약 중' end,
    (public."AD_is_team_professor"() or (r.cohort_id=p_cohort and public."AD_can_read_team"(r.team_id)))
    from public."AD_gpu_reservations" r join public."AD_teams" t on t.id=r.team_id join public."AD_cohorts" c on c.id=r.cohort_id
    where r.status='active' and r.starts_at<day_end and r.ends_at>day_start
    order by r.starts_at,r.id;
end;
$$;
create function public."AD_save_gpu_reservation"(p_team uuid,p_day date,p_start time,p_end time,p_gpu_ids smallint[],p_purpose text)
returns uuid language plpgsql security definer set search_path='' as $$
declare team public."AD_teams"%rowtype; start_at timestamptz; end_at timestamptz; gpu smallint; result_id uuid;
begin
  select * into team from public."AD_teams" where id=p_team for share;
  if not found or not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password)
    or not public."AD_can_read_team"(p_team) then raise exception 'Active team membership required' using errcode='42501';end if;
  if p_day is null or p_start is null or p_end is null or p_purpose is null or char_length(btrim(p_purpose)) not between 1 and 500
    or p_gpu_ids is null or not (p_gpu_ids=array[0]::smallint[] or p_gpu_ids=array[1]::smallint[] or p_gpu_ids=array[0,1]::smallint[]) then
    raise exception 'Invalid reservation' using errcode='23514';end if;
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
create function public."AD_cancel_gpu_reservation"(p_reservation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_gpu_reservations"%rowtype;
begin
  select * into previous from public."AD_gpu_reservations" where id=p_reservation for update;
  if not found or previous.status<>'active' then raise exception 'Active reservation not found' using errcode='23514';end if;
  if not public."AD_is_team_professor"() and not public."AD_can_read_team"(previous.team_id) then
    raise exception 'Team permission required' using errcode='42501';end if;
  update public."AD_gpu_reservations" set status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=auth.uid() where id=p_reservation;
end;
$$;
revoke all on function public."AD_gpu_day_schedule"(uuid,date),public."AD_save_gpu_reservation"(uuid,date,time,time,smallint[],text),public."AD_cancel_gpu_reservation"(uuid) from public,anon,authenticated;
grant execute on function public."AD_gpu_day_schedule"(uuid,date),public."AD_save_gpu_reservation"(uuid,date,time,time,smallint[],text),public."AD_cancel_gpu_reservation"(uuid) to authenticated;
commit;
