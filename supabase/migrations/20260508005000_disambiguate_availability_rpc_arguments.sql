begin;

create or replace function public.set_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
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
  normalized_group_id text := nullif(btrim(set_menu_availability_overlay.group_id), '');
  previous_override boolean;
  row_exists boolean;
begin
  if available_override is null then
    return query select false, false, false, 'set_menu_availability_overlay', 'available_override_required';
    return;
  end if;

  if not public.menu_availability_target_exists(
    set_menu_availability_overlay.menu_id,
    set_menu_availability_overlay.section_id,
    normalized_group_id,
    set_menu_availability_overlay.item_id
  ) then
    return query select false, false, false, 'set_menu_availability_overlay', 'invalid_availability_target';
    return;
  end if;

  if not public.can_edit_availability(set_menu_availability_overlay.menu_id) then
    return query select false, false, false, 'set_menu_availability_overlay', 'permission_denied';
    return;
  end if;

  select true, overlay.available_override
  into row_exists, previous_override
  from public.menu_availability_overlays overlay
  where overlay.menu_id = set_menu_availability_overlay.menu_id
    and overlay.section_id = set_menu_availability_overlay.section_id
    and coalesce(overlay.group_id, '') = coalesce(normalized_group_id, '')
    and overlay.item_id = set_menu_availability_overlay.item_id;

  if coalesce(row_exists, false) and previous_override = available_override then
    return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_unchanged';
    return;
  end if;

  insert into public.menu_availability_overlays (
    menu_id,
    section_id,
    group_id,
    item_id,
    available_override,
    updated_at,
    updated_by
  )
  values (
    set_menu_availability_overlay.menu_id,
    set_menu_availability_overlay.section_id,
    normalized_group_id,
    set_menu_availability_overlay.item_id,
    set_menu_availability_overlay.available_override,
    now(),
    (select auth.uid())
  )
  on conflict (
    menu_id,
    section_id,
    (coalesce(group_id, '')),
    item_id
  )
  do update
  set
    available_override = excluded.available_override,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_updated';
end;
$$;

create or replace function public.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text
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
  normalized_group_id text := nullif(btrim(clear_menu_availability_overlay.group_id), '');
  deleted_count integer := 0;
begin
  if not public.menu_availability_target_exists(
    clear_menu_availability_overlay.menu_id,
    clear_menu_availability_overlay.section_id,
    normalized_group_id,
    clear_menu_availability_overlay.item_id
  ) then
    return query select false, false, false, 'clear_menu_availability_overlay', 'invalid_availability_target';
    return;
  end if;

  if not public.can_edit_availability(clear_menu_availability_overlay.menu_id) then
    return query select false, false, false, 'clear_menu_availability_overlay', 'permission_denied';
    return;
  end if;

  delete from public.menu_availability_overlays overlay
  where overlay.menu_id = clear_menu_availability_overlay.menu_id
    and overlay.section_id = clear_menu_availability_overlay.section_id
    and coalesce(overlay.group_id, '') = coalesce(normalized_group_id, '')
    and overlay.item_id = clear_menu_availability_overlay.item_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    return query select true, false, false, 'clear_menu_availability_overlay', 'availability_overlay_not_found';
    return;
  end if;

  return query select true, true, false, 'clear_menu_availability_overlay', 'availability_overlay_cleared';
end;
$$;

revoke all on function public.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function public.clear_menu_availability_overlay(text, text, text, text) to authenticated;

commit;
