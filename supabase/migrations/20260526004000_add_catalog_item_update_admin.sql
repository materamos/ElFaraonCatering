begin;

create or replace function app_private.update_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text
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
  target_section_id text := nullif(btrim(update_catalog_item.section_id), '');
  target_group_id text := coalesce(nullif(btrim(update_catalog_item.group_id), ''), '');
  target_item_id text := nullif(btrim(update_catalog_item.item_id), '');
  target_name text := nullif(btrim(update_catalog_item.name), '');
  target_description text := nullif(btrim(update_catalog_item.description), '');
  current_name text;
  current_description text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_name_required';
    return;
  end if;

  select item.name, item.description
  into current_name, current_description
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if current_name is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_not_found';
    return;
  end if;

  if current_name is not distinct from target_name
    and current_description is not distinct from target_description then
    return query select true, false, true, 'update_catalog_item', 'catalog_item_unchanged';
    return;
  end if;

  update menu_content.menu_catalog_items item
  set
    name = target_name,
    description = target_description
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  return query select true, true, true, 'update_catalog_item', 'catalog_item_updated';
end;
$$;

create or replace function public.update_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.update_catalog_item($1, $2, $3, $4, $5);
$$;

revoke all on function public.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.update_catalog_item(text, text, text, text, text) to authenticated;
grant execute on function app_private.update_catalog_item(text, text, text, text, text) to authenticated;

commit;
