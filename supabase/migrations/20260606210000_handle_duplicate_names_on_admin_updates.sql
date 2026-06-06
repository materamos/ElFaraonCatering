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

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and item.group_id = target_group_id
      and item.item_id <> target_item_id
      and app_private.normalize_visible_name(item.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_exists';
    return;
  end if;

  begin
    update menu_content.menu_catalog_items item
    set
      name = target_name,
      description = target_description
    where item.section_id = target_section_id
      and item.group_id = target_group_id
      and item.item_id = target_item_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_catalog_item', 'catalog_item_exists';
      return;
  end;

  return query select true, true, true, 'update_catalog_item', 'catalog_item_updated';
end;
$$;

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

  if exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id <> target_option_id
      and app_private.normalize_visible_name(option.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  begin
    update menu_content.menu_catalog_item_options option
    set name = target_name
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id = target_option_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_catalog_item_option', 'catalog_option_exists';
      return;
  end;

  return query select true, true, true, 'update_catalog_item_option', 'catalog_option_updated';
end;
$$;

create or replace function app_private.update_grill_item(
  item_id text,
  name text,
  variant_name text
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
  target_item_id text := nullif(btrim(update_grill_item.item_id), '');
  target_name text := nullif(btrim(update_grill_item.name), '');
  target_variant_name text := nullif(btrim(update_grill_item.variant_name), '');
  target_family_id text;
  current_name text;
  current_variant_name text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_grill_item', 'permission_denied';
    return;
  end if;

  if target_item_id is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_name_required';
    return;
  end if;

  select item.family_id, item.name, item.variant_name
  into target_family_id, current_name, current_variant_name
  from menu_content.menu_grill_catalog_items item
  where item.item_id = target_item_id;

  if current_name is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_not_found';
    return;
  end if;

  if current_name is not distinct from target_name
    and current_variant_name is not distinct from target_variant_name then
    return query select true, false, true, 'update_grill_item', 'grill_item_unchanged';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_catalog_items item
    where item.family_id = target_family_id
      and item.item_id <> target_item_id
      and app_private.normalize_visible_name(coalesce(item.variant_name, item.name))
        = app_private.normalize_visible_name(coalesce(target_variant_name, target_name))
  ) then
    return query select false, false, true, 'update_grill_item', 'grill_item_exists';
    return;
  end if;

  begin
    update menu_content.menu_grill_catalog_items item
    set
      name = target_name,
      variant_name = target_variant_name
    where item.item_id = target_item_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_grill_item', 'grill_item_exists';
      return;
  end;

  return query select true, true, true, 'update_grill_item', 'grill_item_updated';
end;
$$;

create or replace function app_private.update_grill_product(
  family_id text,
  title text
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
  target_family_id text := nullif(btrim(update_grill_product.family_id), '');
  target_title text := nullif(btrim(update_grill_product.title), '');
  current_title text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_grill_product', 'permission_denied';
    return;
  end if;

  if target_family_id is null then
    return query select false, false, true, 'update_grill_product', 'grill_product_id_required';
    return;
  end if;

  if target_title is null then
    return query select false, false, true, 'update_grill_product', 'grill_product_name_required';
    return;
  end if;

  select family.title
  into current_title
  from menu_content.menu_grill_families family
  where family.family_id = target_family_id;

  if current_title is null then
    return query select false, false, true, 'update_grill_product', 'grill_family_not_found';
    return;
  end if;

  if current_title is not distinct from target_title then
    return query select true, false, true, 'update_grill_product', 'grill_product_unchanged';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_families family
    where family.family_id <> target_family_id
      and app_private.normalize_visible_name(family.title) = app_private.normalize_visible_name(target_title)
  ) then
    return query select false, false, true, 'update_grill_product', 'grill_product_exists';
    return;
  end if;

  begin
    update menu_content.menu_grill_families family
    set title = target_title
    where family.family_id = target_family_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_grill_product', 'grill_product_exists';
      return;
  end;

  return query select true, true, true, 'update_grill_product', 'grill_product_updated';
end;
$$;

revoke all on function app_private.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_grill_item(text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_grill_product(text, text) from public, anon, authenticated;

grant execute on function app_private.update_catalog_item(text, text, text, text, text) to authenticated;
grant execute on function app_private.update_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function app_private.update_grill_item(text, text, text) to authenticated;
grant execute on function app_private.update_grill_product(text, text) to authenticated;

commit;
