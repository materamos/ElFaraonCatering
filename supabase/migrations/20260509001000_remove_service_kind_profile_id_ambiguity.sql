begin;

create or replace function public.set_profile_service_kind(
  profile_id text,
  service_kind text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_profile_id text := set_profile_service_kind.profile_id;
  target_service_kind text := set_profile_service_kind.service_kind;
  current_service_kind text;
  updated_count integer := 0;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'set_profile_service_kind', 'permission_denied';
    return;
  end if;

  if target_service_kind not in ('daily-menu', 'grill') then
    return query select false, false, true, 'set_profile_service_kind', 'invalid_service_kind';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_profiles profile
    where profile.id = target_profile_id
  ) then
    return query select false, false, true, 'set_profile_service_kind', 'profile_not_found';
    return;
  end if;

  select settings.service_kind
  into current_service_kind
  from menu_content.menu_profile_service_settings settings
  where settings.profile_id = target_profile_id;

  if current_service_kind = target_service_kind then
    return query select true, false, true, 'set_profile_service_kind', 'service_kind_unchanged';
    return;
  end if;

  update menu_content.menu_profile_service_settings settings
  set service_kind = target_service_kind
  where settings.profile_id = target_profile_id;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    begin
      insert into menu_content.menu_profile_service_settings (
        profile_id,
        service_kind
      )
      values (
        target_profile_id,
        target_service_kind
      );
    exception
      when unique_violation then
        update menu_content.menu_profile_service_settings settings
        set service_kind = target_service_kind
        where settings.profile_id = target_profile_id;
    end;
  end if;

  return query select true, true, true, 'set_profile_service_kind', 'service_kind_updated';
end;
$$;

revoke all on function public.set_profile_service_kind(text, text) from public, anon, authenticated;
grant execute on function public.set_profile_service_kind(text, text) to authenticated;

commit;
