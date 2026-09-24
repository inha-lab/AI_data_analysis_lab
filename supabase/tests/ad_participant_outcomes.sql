begin;
do $$
declare professor uuid; cohort uuid; suffix text:=gen_random_uuid()::text; i integer; labels text[]:=array['active','completed','dropout','inactive'];
begin
  select id into strict professor from public."AD_profiles" where role='professor' and is_active and not must_change_password limit 1;
  perform set_config('request.jwt.claim.sub',professor::text,true);
  insert into public."AD_cohorts"(name) values('AD_OUTCOME_TEST_'||suffix) returning id into cohort;
  perform set_config('ad.outcome_cohort',cohort::text,true);
  for i in 1..4 loop
    insert into public."AD_participants"(cohort_id,full_name,email,department,student_number,grade,phone,job_group,status)
      values(cohort,'Outcome '||i,'outcome-'||i||'-'||suffix||'@example.invalid','Test','0'||i,'3','010-0000-0000','ai_development',labels[i]);
  end loop;
  if (select count(*) from public."AD_participants" where cohort_id=cohort)<>4 then raise exception 'New statuses not stored';end if;
  begin
    insert into public."AD_participants"(cohort_id,full_name,email,department,student_number,grade,phone,job_group,status)
      values(cohort,'Bad','bad-'||suffix||'@example.invalid','Test','05','3','010-0000-0000','ai_development','unknown');
    raise exception 'Unknown status accepted';
  exception when check_violation then null;end;
end $$;
set local role authenticated;
do $$
declare counts jsonb:=public."AD_dashboard_participant_counts"(); cohort uuid:=current_setting('ad.outcome_cohort')::uuid;
begin
  if (counts->>'total')::int<>(select count(*) from public."AD_participants") or
     (counts->>'active')::int<>(select count(*) from public."AD_participants" where status='active') or
     (counts->>'completed')::int<>(select count(*) from public."AD_participants" where status='completed') or
     (counts->>'dropout')::int<>(select count(*) from public."AD_participants" where status='dropout') or
     (counts->>'inactive')::int<>(select count(*) from public."AD_participants" where status='inactive') then
    raise exception 'Dashboard counts incorrect: %',counts;
  end if;
  if (select count(*) from public."AD_participants" where cohort_id=cohort and status in ('completed','dropout'))<>2 then raise exception 'Outcomes lost';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);end $$;
set local role authenticated;
do $$begin
  begin perform public."AD_dashboard_participant_counts"();raise exception 'Unprivileged account count allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claim.sub','',true);end $$;
set local role anon;
do $$begin
  begin perform public."AD_dashboard_participant_counts"();raise exception 'Anonymous count allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Participant outcomes and professor totals passed; fixtures rolled back' as result;
rollback;
