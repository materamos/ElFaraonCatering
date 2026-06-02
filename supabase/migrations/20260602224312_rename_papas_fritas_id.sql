do $$
declare
  old_item_id constant text := 'chips-papa';
  new_item_id constant text := 'papas-fritas';
  old_pricing_key constant text := 'catalog:guarniciones:item:chips-papa:price';
  new_pricing_key constant text := 'catalog:guarniciones:item:papas-fritas:price';
begin
  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'guarniciones'
      and item.group_id = ''
      and item.item_id = new_item_id
  ) then
    raise exception 'Cannot rename %, target item id % already exists in guarniciones', old_item_id, new_item_id;
  end if;

  if not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'guarniciones'
      and item.group_id = ''
      and item.item_id = old_item_id
  ) then
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_prices price
    where price.pricing_key = new_pricing_key
  ) then
    raise exception 'Cannot rename %, target pricing key % already exists', old_pricing_key, new_pricing_key;
  end if;

  insert into menu_content.menu_prices (
    pricing_key,
    kind,
    amount
  )
  select
    new_pricing_key,
    price.kind,
    price.amount
  from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key;

  update menu_content.menu_catalog_items item
  set
    item_id = new_item_id,
    pricing_key = new_pricing_key
  where item.section_id = 'guarniciones'
    and item.group_id = ''
    and item.item_id = old_item_id;

  update public.menu_availability_overlays overlay
  set item_id = new_item_id
  where overlay.section_id = 'guarniciones'
    and coalesce(overlay.group_id, '') = ''
    and overlay.item_id = old_item_id;

  delete from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key
    and not exists (
      select 1
      from menu_content.menu_catalog_items item
      where item.pricing_key = old_pricing_key
    )
    and not exists (
      select 1
      from menu_content.menu_catalog_groups menu_group
      where menu_group.pricing_key = old_pricing_key
    )
    and not exists (
      select 1
      from menu_content.menu_daily_items daily_item
      where daily_item.pricing_key = old_pricing_key
    )
    and not exists (
      select 1
      from menu_content.menu_grill_catalog_items grill_item
      where grill_item.pricing_key = old_pricing_key
    );
end $$;
