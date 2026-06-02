create or replace function app_private.add_catalog_item_option(
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
  target_section_id text := nullif(btrim(add_catalog_item_option.section_id), '');
  target_group_id text := coalesce(nullif(btrim(add_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(add_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(add_catalog_item_option.option_id), '');
  target_name text := nullif(btrim(add_catalog_item_option.name), '');
  target_catalog_item_id bigint;
  target_item_name text;
  existing_option_count integer;
  next_order_index integer;
  is_side_option_item boolean;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_name_required';
    return;
  end if;

  if target_section_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or target_option_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (target_group_id <> '' and target_group_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then
    return query select false, false, true, 'add_catalog_item_option', 'invalid_catalog_option_id';
    return;
  end if;

  select item.id, item.name
  into target_catalog_item_id, target_item_name
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  select count(*)
  into existing_option_count
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id;

  if existing_option_count = 0 then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_options_not_enabled';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id = target_option_id
  ) then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  is_side_option_item :=
    target_section_id = 'guarniciones'
    or target_item_id in ('guarnicion', 'guarniciones', 'guarnicion-sola')
    or lower(target_item_name) in ('guarnicion', 'guarniciones');

  if is_side_option_item then
    select max(option.order_index)
    into next_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id;

    update menu_content.menu_catalog_item_options option
    set order_index = option.order_index + 1
    where option.catalog_item_id = target_catalog_item_id
      and option.order_index >= next_order_index;
  else
    select coalesce(max(option.order_index), -1) + 1
    into next_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id;
  end if;

  insert into menu_content.menu_catalog_item_options (
    catalog_item_id,
    option_id,
    name,
    available,
    order_index
  )
  values (
    target_catalog_item_id,
    target_option_id,
    target_name,
    true,
    next_order_index
  );

  return query select true, true, true, 'add_catalog_item_option', 'catalog_option_added';
end;
$$;

revoke all on function app_private.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
grant execute on function app_private.add_catalog_item_option(text, text, text, text, text) to authenticated;

do $$
declare
  chips_item_id text;
  chips_item_group_id text;
  chips_item_order_index integer;
  previous_item_id text;
  previous_item_group_id text;
  previous_item_order_index integer;
  side_item record;
  chips_option_id text;
  chips_order_index integer;
  previous_option_id text;
  previous_order_index integer;
begin
  select item.item_id, item.group_id, item.order_index
  into chips_item_id, chips_item_group_id, chips_item_order_index
  from menu_content.menu_catalog_items item
  where item.section_id = 'guarniciones'
    and (
      lower(item.item_id) in ('chips', 'papas-chips')
      or lower(item.name) = 'chips'
      or lower(item.name) like '% chips'
      or lower(item.name) like '%chips %'
    )
    and item.order_index = (
      select max(last_item.order_index)
      from menu_content.menu_catalog_items last_item
      where last_item.section_id = item.section_id
        and last_item.group_id = item.group_id
    )
  order by item.item_id
  limit 1;

  if chips_item_id is not null then
    select item.item_id, item.group_id, item.order_index
    into previous_item_id, previous_item_group_id, previous_item_order_index
    from menu_content.menu_catalog_items item
    where item.section_id = 'guarniciones'
      and item.group_id = chips_item_group_id
      and item.item_id <> chips_item_id
    order by item.order_index desc, item.item_id desc
    limit 1;

    if previous_item_id is not null then
      update menu_content.menu_catalog_items item
      set order_index = item.order_index + 1000
      where item.section_id = 'guarniciones'
        and item.group_id = chips_item_group_id
        and item.item_id in (chips_item_id, previous_item_id);

      update menu_content.menu_catalog_items item
      set order_index = case
        when item.item_id = chips_item_id then previous_item_order_index
        else chips_item_order_index
      end
      where item.section_id = 'guarniciones'
        and item.group_id = chips_item_group_id
        and item.item_id in (chips_item_id, previous_item_id);
    end if;
  end if;

  for side_item in
    select item.id as catalog_item_id
    from menu_content.menu_catalog_items item
    where item.section_id = 'guarniciones'
      or item.item_id in ('guarnicion', 'guarniciones', 'guarnicion-sola')
      or lower(item.name) in ('guarnicion', 'guarniciones')
  loop
    select option.option_id, option.order_index
    into chips_option_id, chips_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = side_item.catalog_item_id
      and (
        lower(option.option_id) in ('chips', 'papas-chips')
        or lower(option.name) = 'chips'
        or lower(option.name) like '% chips'
        or lower(option.name) like '%chips %'
      )
      and option.order_index = (
        select max(last_option.order_index)
        from menu_content.menu_catalog_item_options last_option
        where last_option.catalog_item_id = side_item.catalog_item_id
      )
    order by option.option_id
    limit 1;

    if chips_option_id is null then
      continue;
    end if;

    select option.option_id, option.order_index
    into previous_option_id, previous_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = side_item.catalog_item_id
      and option.option_id <> chips_option_id
    order by option.order_index desc, option.option_id desc
    limit 1;

    if previous_option_id is null then
      continue;
    end if;

    update menu_content.menu_catalog_item_options option
    set order_index = option.order_index + 1000
    where option.catalog_item_id = side_item.catalog_item_id
      and option.option_id in (chips_option_id, previous_option_id);

    update menu_content.menu_catalog_item_options option
    set order_index = case
      when option.option_id = chips_option_id then previous_order_index
      else chips_order_index
    end
    where option.catalog_item_id = side_item.catalog_item_id
      and option.option_id in (chips_option_id, previous_option_id);
  end loop;
end $$;
