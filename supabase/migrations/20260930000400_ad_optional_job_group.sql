begin;
alter table public."AD_participants" drop constraint "AD_participants_job_check";
alter table public."AD_participants" add constraint "AD_participants_job_check" check (
  (job_group in ('unspecified','sw_engineering','sw_development','ai_development') and job_group_other is null)
  or (job_group='other' and job_group_other=btrim(job_group_other) and char_length(job_group_other) between 1 and 80)
);
do $$ declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='AD_update_my_profile_v2';
  definition:=replace(definition,'p_job_group not in (''sw_engineering'',''sw_development'',''ai_development'',''other'')','p_job_group not in (''unspecified'',''sw_engineering'',''sw_development'',''ai_development'',''other'')');
  execute definition;
end $$;
notify pgrst,'reload schema';
commit;
