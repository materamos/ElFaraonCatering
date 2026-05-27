begin;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('app_private.get_admin_catalog_editor_state()'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'\n                    ''description'', option.description,',
    ''
  );

  if current_definition = updated_definition then
    raise exception 'app_private.get_admin_catalog_editor_state did not contain expected option description reference';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.get_admin_operational_state()'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'      coalesce(nullif(btrim(item.variant_name), ''''), item.name) as name,\n      item.description,\n      true as base_available,',
    E'      coalesce(nullif(btrim(item.variant_name), ''''), item.name) as name,\n      null::text as description,\n      true as base_available,'
  );
  updated_definition := replace(
    updated_definition,
    E'      item.name || '' - '' || option.name as name,\n      option.description,\n      true as base_available,',
    E'      item.name || '' - '' || option.name as name,\n      null::text as description,\n      true as base_available,'
  );

  if current_definition = updated_definition then
    raise exception 'app_private.get_admin_operational_state did not contain expected option or grill description references';
  end if;

  execute updated_definition;
end;
$$;

revoke all on function public.update_catalog_item_option(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text, text, text) from public, anon, authenticated;

drop function public.update_catalog_item_option(text, text, text, text, text, text);
drop function app_private.update_catalog_item_option(text, text, text, text, text, text);

create or replace function app_private.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
  name text
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
  target_section_id text := nullif(btrim(update_catalog_item_option.section_id), '');
  target_group_id text := coalesce(nullif(btrim(update_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(update_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(update_catalog_item_option.option_id), '');
  target_name text := nullif(btrim(update_catalog_item_option.name), '');
  target_catalog_item_id bigint;
  current_name text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_name_required';
    return;
  end if;

  select item.id
  into target_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  select option.name
  into current_name
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  if current_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_not_found';
    return;
  end if;

  if current_name is not distinct from target_name then
    return query select true, false, true, 'update_catalog_item_option', 'catalog_option_unchanged';
    return;
  end if;

  update menu_content.menu_catalog_item_options option
  set name = target_name
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  return query select true, true, true, 'update_catalog_item_option', 'catalog_option_updated';
end;
$$;

create or replace function public.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
  name text
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
  from app_private.update_catalog_item_option($1, $2, $3, $4, $5);
$$;

revoke all on function app_private.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;

grant execute on function app_private.update_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function public.update_catalog_item_option(text, text, text, text, text) to authenticated;

alter table menu_content.menu_catalog_item_options
  drop column if exists description;

alter table menu_content.menu_grill_catalog_items
  drop column if exists description;

commit;
