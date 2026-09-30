begin;

create or replace function public."AD_delete_announcement"(p_cohort uuid,p_announcement uuid,p_version timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare previous public."AD_announcements"%rowtype;
begin
  if not public."AD_is_team_professor"() then raise exception 'Manager permission required' using errcode='42501'; end if;
  select * into previous from public."AD_announcements" where id=p_announcement for update;
  if not found or previous.cohort_id<>p_cohort then raise exception 'Announcement not found' using errcode='23514'; end if;
  if previous.updated_at is distinct from p_version then raise exception 'Announcement changed' using errcode='40001'; end if;
  delete from public."AD_announcements" where id=p_announcement;
end;
$$;
revoke all on function public."AD_delete_announcement"(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public."AD_delete_announcement"(uuid,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';

commit;
