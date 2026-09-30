begin;
create function public."AD_format_contact"(value text) returns text language sql immutable set search_path='' as $$
  select case when regexp_replace(btrim(value),'[^0-9]','','g') ~ '^010[0-9]{8}$'
    then regexp_replace(regexp_replace(btrim(value),'[^0-9]','','g'),'^([0-9]{3})([0-9]{4})([0-9]{4})$','\1-\2-\3')
    else btrim(value) end;
$$;
create function public."AD_normalize_contact"() returns trigger language plpgsql set search_path='' as $$
begin new.phone:=public."AD_format_contact"(new.phone);return new;end;$$;
create trigger "AD_participants_normalize_contact" before insert or update of phone on public."AD_participants" for each row execute function public."AD_normalize_contact"();
create trigger "AD_profiles_normalize_contact" before insert or update of phone on public."AD_profiles" for each row execute function public."AD_normalize_contact"();
update public."AD_participants" set phone=public."AD_format_contact"(phone) where phone is distinct from public."AD_format_contact"(phone);
update public."AD_profiles" set phone=public."AD_format_contact"(phone) where phone is not null and phone is distinct from public."AD_format_contact"(phone);
revoke all on function public."AD_format_contact"(text),public."AD_normalize_contact"() from public,anon,authenticated;
commit;
