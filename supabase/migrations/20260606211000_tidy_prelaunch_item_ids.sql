begin;

do $$
declare
  old_item_id constant text := 'yogur-descremado';
  new_item_id constant text := 'yogur-sin-cereales-o-con-colchon';
  old_pricing_key constant text := 'catalog:cafeteria:item:yogur-descremado:price';
  new_pricing_key constant text := 'catalog:cafeteria:item:yogur-sin-cereales-o-con-colchon:price';
begin
  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'cafeteria'
      and item.group_id = ''
      and item.item_id = new_item_id
  ) then
    raise exception 'Cannot rename %, target item id % already exists in cafeteria', old_item_id, new_item_id;
  end if;

  if not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'cafeteria'
      and item.group_id = ''
      and item.item_id = old_item_id
  ) then
    raise exception 'Expected item id % before renaming it to %', old_item_id, new_item_id;
  end if;

  if exists (
    select 1
    from menu_content.menu_prices price
    where price.pricing_key = new_pricing_key
  ) then
    raise exception 'Cannot rename %, target pricing key % already exists', old_pricing_key, new_pricing_key;
  end if;

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  select new_pricing_key, price.kind, price.amount
  from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key;

  update menu_content.menu_catalog_items item
  set
    item_id = new_item_id,
    pricing_key = new_pricing_key
  where item.section_id = 'cafeteria'
    and item.group_id = ''
    and item.item_id = old_item_id;

  update public.menu_availability_overlays overlay
  set item_id = new_item_id
  where overlay.section_id = 'cafeteria'
    and coalesce(overlay.group_id, '') = ''
    and overlay.item_id = old_item_id;

  delete from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key;
end $$;

do $$
declare
  old_item_id constant text := 'gatorade-manzana';
  new_item_id constant text := 'gatorade';
  old_pricing_key constant text := 'catalog:bebidas:item:gatorade-manzana:price';
  new_pricing_key constant text := 'catalog:bebidas:item:gatorade:price';
begin
  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'bebidas'
      and item.group_id = ''
      and item.item_id = new_item_id
  ) then
    raise exception 'Cannot rename %, target item id % already exists in bebidas', old_item_id, new_item_id;
  end if;

  if not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'bebidas'
      and item.group_id = ''
      and item.item_id = old_item_id
  ) then
    raise exception 'Expected item id % before renaming it to %', old_item_id, new_item_id;
  end if;

  if exists (
    select 1
    from menu_content.menu_prices price
    where price.pricing_key = new_pricing_key
  ) then
    raise exception 'Cannot rename %, target pricing key % already exists', old_pricing_key, new_pricing_key;
  end if;

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  select new_pricing_key, price.kind, price.amount
  from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key;

  update menu_content.menu_catalog_items item
  set
    item_id = new_item_id,
    pricing_key = new_pricing_key
  where item.section_id = 'bebidas'
    and item.group_id = ''
    and item.item_id = old_item_id;

  update public.menu_availability_overlays overlay
  set item_id = new_item_id
  where overlay.section_id = 'bebidas'
    and coalesce(overlay.group_id, '') = ''
    and overlay.item_id = old_item_id;

  delete from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key;
end $$;

update menu_content.menu_grill_catalog_items
set name = 'Sándwich de entraña completo con guarnición'
where item_id = 'parrilla-sandwich-entrana-guarnicion';

commit;
