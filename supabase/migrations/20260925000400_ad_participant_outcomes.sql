begin;
alter table public."AD_participants" drop constraint "AD_participants_status_check";
alter table public."AD_participants" add constraint "AD_participants_status_check"
  check (status in ('active','completed','dropout','inactive'));

create function public."AD_dashboard_participant_counts"()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501'; end if;
  select jsonb_build_object(
    'total',count(*),
    'active',count(*) filter(where status='active'),
    'completed',count(*) filter(where status='completed'),
    'dropout',count(*) filter(where status='dropout'),
    'inactive',count(*) filter(where status='inactive')
  ) into result from public."AD_participants";
  return result;
end;
$$;
revoke all on function public."AD_dashboard_participant_counts"() from public,anon,authenticated;
grant execute on function public."AD_dashboard_participant_counts"() to authenticated;
commit;
