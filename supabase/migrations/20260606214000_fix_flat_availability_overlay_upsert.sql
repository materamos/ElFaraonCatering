begin;

create or replace function app_private.set_menu_availability_overlay(
  menu_id text,
  section_id text,
  item_id text,
  available_override boolean
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
  target_menu_id text := set_menu_availability_overlay.menu_id;
  target_section_id text := set_menu_availability_overlay.section_id;
  target_item_id text := set_menu_availability_overlay.item_id;
  target_available_override boolean := set_menu_availability_overlay.available_override;
  previous_override boolean;
  row_exists boolean;
  updated_count integer;
begin
  if target_available_override is null then
    return query select false, false, false, 'set_menu_availability_overlay', 'available_override_required';
    return;
  end if;

  if target_available_override is true then
    if not public.menu_availability_target_exists(
      target_menu_id,
      target_section_id,
      target_item_id
    ) then
      return query select false, false, false, 'set_menu_availability_overlay', 'invalid_availability_target';
      return;
    end if;

    if not public.can_edit_availability(target_menu_id) then
      return query select false, false, false, 'set_menu_availability_overlay', 'permission_denied';
      return;
    end if;

    delete from public.menu_availability_overlays overlay
    where overlay.menu_id = target_menu_id
      and overlay.section_id = target_section_id
      and overlay.item_id = target_item_id;

    if found then
      return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_cleared';
    else
      return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_not_found';
    end if;
    return;
  end if;

  if not public.menu_availability_target_exists(
    target_menu_id,
    target_section_id,
    target_item_id
  ) then
    return query select false, false, false, 'set_menu_availability_overlay', 'invalid_availability_target';
    return;
  end if;

  if not public.can_edit_availability(target_menu_id) then
    return query select false, false, false, 'set_menu_availability_overlay', 'permission_denied';
    return;
  end if;

  select true, overlay.available_override
  into row_exists, previous_override
  from public.menu_availability_overlays overlay
  where overlay.menu_id = target_menu_id
    and overlay.section_id = target_section_id
    and overlay.item_id = target_item_id;

  if coalesce(row_exists, false) and previous_override is false then
    return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_unchanged';
    return;
  end if;

  update public.menu_availability_overlays overlay
  set
    available_override = false,
    updated_at = now(),
    updated_by = (select auth.uid())
  where overlay.menu_id = target_menu_id
    and overlay.section_id = target_section_id
    and overlay.item_id = target_item_id;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    begin
      insert into public.menu_availability_overlays (
        menu_id,
        section_id,
        item_id,
        available_override,
        updated_at,
        updated_by
      )
      values (
        target_menu_id,
        target_section_id,
        target_item_id,
        false,
        now(),
        (select auth.uid())
      );
    exception
      when unique_violation then
        update public.menu_availability_overlays overlay
        set
          available_override = false,
          updated_at = now(),
          updated_by = (select auth.uid())
        where overlay.menu_id = target_menu_id
          and overlay.section_id = target_section_id
          and overlay.item_id = target_item_id;
    end;
  end if;

  return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_updated';
end;
$$;

revoke all on function app_private.set_menu_availability_overlay(text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function app_private.set_menu_availability_overlay(text, text, text, boolean)
  to authenticated;

commit;
