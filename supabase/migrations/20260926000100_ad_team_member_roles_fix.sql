begin;
create or replace function public."AD_save_team_v2"(p_cohort uuid,p_values jsonb,p_members uuid[],p_leader uuid,p_team uuid,p_version timestamptz,p_roles jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; member_id uuid; role_value text;
begin
  if not public."AD_is_team_professor"() then raise exception 'Professor permission required' using errcode='42501';end if;
  if p_roles is null or jsonb_typeof(p_roles)<>'object' or exists(
    select 1 from jsonb_each(p_roles) entry where jsonb_typeof(entry.value)<>'string'
      or entry.key not in (select members.id::text from unnest(p_members) as members(id))
      or char_length(btrim(entry.value#>>'{}'))>80
  ) then raise exception 'Invalid team member roles' using errcode='23514';end if;
  result_id:=public."AD_save_team"(p_cohort,p_values,p_members,p_leader,p_team,p_version);
  foreach member_id in array p_members loop
    role_value:=btrim(coalesce(p_roles->>member_id::text,''));
    update public."AD_team_members" set role_title=role_value where team_id=result_id and participant_id=member_id;
  end loop;
  return result_id;
end;
$$;
notify pgrst,'reload schema';
commit;
