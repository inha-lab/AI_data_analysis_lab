begin;

create function public."AD_admin_accounts"()
returns table(id uuid, email text, display_name text, phone text, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public."AD_profiles" p
    where p.id = auth.uid() and p.role = 'professor' and p.is_active and not p.must_change_password
  ) then raise exception '관리자 조회 권한이 없습니다.' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.phone, p.is_active, p.created_at
    from public."AD_profiles" p join auth.users u on u.id = p.id
    where p.role = 'professor'
    order by p.is_active desc, p.created_at;
end $$;

create function public."AD_update_my_profile"(p_display_name text, p_phone text)
returns table(id uuid, display_name text, phone text)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := auth.uid(); v_name text := btrim(coalesce(p_display_name, '')); v_phone text := btrim(coalesce(p_phone, ''));
begin
  if v_id is null or not exists (
    select 1 from public."AD_profiles" p where p.id = v_id and p.is_active and not p.must_change_password
  ) then raise exception '개인정보 수정 권한이 없습니다.' using errcode = '42501'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then raise exception '이름 형식이 올바르지 않습니다.' using errcode = '23514'; end if;
  if v_phone !~ '^[0-9+() -]+$' or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 9 and 15 then
    raise exception '전화번호 형식이 올바르지 않습니다.' using errcode = '23514';
  end if;
  update public."AD_profiles" p set display_name = v_name, phone = v_phone, updated_at = clock_timestamp() where p.id = v_id;
  update public."AD_participants" p set full_name = v_name, phone = v_phone where p.profile_id = v_id;
  return query select p.id, p.display_name, p.phone from public."AD_profiles" p where p.id = v_id;
end $$;

revoke all on function public."AD_admin_accounts"() from public, anon;
revoke all on function public."AD_update_my_profile"(text, text) from public, anon;
grant execute on function public."AD_admin_accounts"() to authenticated;
grant execute on function public."AD_update_my_profile"(text, text) to authenticated;

commit;
