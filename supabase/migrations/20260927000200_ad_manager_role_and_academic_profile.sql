begin;

alter table public."AD_profiles" drop constraint "AD_profiles_role_check";
alter table public."AD_profiles" add constraint "AD_profiles_role_check"
  check (role in ('professor', 'admin', 'consultant', 'researcher', 'student'));

alter table public."AD_participants" add column job_group_other text;
alter table public."AD_participants" drop constraint "AD_participants_job_check";
alter table public."AD_participants" add constraint "AD_participants_job_check" check (
  (job_group in ('sw_engineering', 'sw_development', 'ai_development') and job_group_other is null)
  or (job_group = 'other' and job_group_other = btrim(job_group_other) and char_length(job_group_other) between 1 and 80)
);
grant insert (job_group_other) on public."AD_participants" to authenticated;
grant update (job_group_other) on public."AD_participants" to authenticated;

-- Give operational administrators the same program-management permissions as professors.
-- The administrator-account function is deliberately excluded and recreated professor-only below.
do $$ declare f record; definition text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'AD_%' and p.proname <> 'AD_admin_accounts'
      and pg_get_functiondef(p.oid) like '%role%professor%'
  loop
    definition := pg_get_functiondef(f.oid);
    definition := replace(definition, 'role = ''professor''', 'role in (''professor'', ''admin'')');
    definition := replace(definition, 'role=''professor''', 'role in (''professor'', ''admin'')');
    execute definition;
  end loop;
end $$;

do $$ declare p record; q text; c text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname='public' and (coalesce(qual,'') like '%role%professor%' or coalesce(with_check,'') like '%role%professor%')
  loop
    q := replace(replace(p.qual, 'role = ''professor''::text', 'role = ANY (ARRAY[''professor''::text, ''admin''::text])'), 'role = ''professor''', 'role in (''professor'', ''admin'')');
    c := replace(replace(p.with_check, 'role = ''professor''::text', 'role = ANY (ARRAY[''professor''::text, ''admin''::text])'), 'role = ''professor''', 'role in (''professor'', ''admin'')');
    execute format('alter policy %I on %I.%I %s %s', p.policyname, p.schemaname, p.tablename,
      case when q is null then '' else 'using ('||q||')' end,
      case when c is null then '' else 'with check ('||c||')' end);
  end loop;
end $$;

drop function public."AD_admin_accounts"();
create function public."AD_admin_accounts"()
returns table(id uuid, email text, display_name text, phone text, role text, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public."AD_profiles" p where p.id=auth.uid() and p.role='professor' and p.is_active and not p.must_change_password)
    then raise exception '관리자 조회 권한이 없습니다.' using errcode='42501'; end if;
  return query select p.id,u.email::text,p.display_name,p.phone,p.role,p.is_active,p.created_at
    from public."AD_profiles" p join auth.users u on u.id=p.id where p.role in ('professor','admin') order by p.is_active desc,p.created_at;
end $$;
revoke all on function public."AD_admin_accounts"() from public, anon;
grant execute on function public."AD_admin_accounts"() to authenticated;

create function public."AD_my_academic_profile"()
returns table(department text, grade text, job_group text, job_group_other text)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public."AD_profiles" where id=auth.uid() and role='student' and is_active and not must_change_password)
    then return; end if;
  return query select p.department,p.grade,p.job_group,p.job_group_other from public."AD_participants" p
    where p.profile_id=auth.uid() and p.status='active' order by p.created_at desc limit 1;
end $$;
revoke all on function public."AD_my_academic_profile"() from public, anon;
grant execute on function public."AD_my_academic_profile"() to authenticated;

create function public."AD_update_my_profile_v2"(p_display_name text,p_phone text,p_department text default null,p_grade text default null,p_job_group text default null,p_job_group_other text default null)
returns table(id uuid,display_name text,phone text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid(); v_role text; v_name text:=btrim(coalesce(p_display_name,'')); v_phone text:=btrim(coalesce(p_phone,''));
begin
  select p.role into v_role from public."AD_profiles" p where p.id=v_id and p.is_active and not p.must_change_password;
  if not found then raise exception '개인정보 수정 권한이 없습니다.' using errcode='42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception '이름 형식이 올바르지 않습니다.' using errcode='23514'; end if;
  if v_phone !~ '^[0-9+() .-]+$' or char_length(regexp_replace(v_phone,'[^0-9]','','g')) not between 9 and 15 then raise exception '전화번호 형식이 올바르지 않습니다.' using errcode='23514'; end if;
  if v_role='student' then
    if char_length(btrim(coalesce(p_department,''))) not between 1 and 100 or char_length(btrim(coalesce(p_grade,''))) not between 1 and 30
      or p_job_group not in ('sw_engineering','sw_development','ai_development','other')
      or (p_job_group='other' and char_length(btrim(coalesce(p_job_group_other,''))) not between 1 and 80)
      then raise exception '학적 정보 형식이 올바르지 않습니다.' using errcode='23514'; end if;
  end if;
  update public."AD_profiles" p set display_name=v_name,phone=v_phone,updated_at=clock_timestamp() where p.id=v_id;
  update public."AD_participants" p set full_name=v_name,phone=v_phone,
    department=case when v_role='student' then btrim(p_department) else p.department end,
    grade=case when v_role='student' then btrim(p_grade) else p.grade end,
    job_group=case when v_role='student' then p_job_group else p.job_group end,
    job_group_other=case when v_role='student' and p_job_group='other' then btrim(p_job_group_other) else null end
    where p.profile_id=v_id;
  return query select p.id,p.display_name,p.phone from public."AD_profiles" p where p.id=v_id;
end $$;
revoke all on function public."AD_update_my_profile_v2"(text,text,text,text,text,text) from public, anon;
grant execute on function public."AD_update_my_profile_v2"(text,text,text,text,text,text) to authenticated;

commit;
