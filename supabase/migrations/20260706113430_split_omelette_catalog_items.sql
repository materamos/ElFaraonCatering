begin;

do $$
declare
  target_section_id constant text := 'tartas-tortillas-omelettes';
  old_item_id constant text := 'omelette';
  spinach_item_id constant text := 'omelette-espinaca-muzzarella';
  ham_item_id constant text := 'omelette-jamon-queso';
  old_pricing_key constant text := 'catalog:tartas-tortillas-omelettes:item:omelette:price';
  spinach_pricing_key constant text := 'catalog:tartas-tortillas-omelettes:item:omelette-espinaca-muzzarella:price';
  ham_pricing_key constant text := 'catalog:tartas-tortillas-omelettes:item:omelette-jamon-queso:price';
begin
  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and item.item_id = old_item_id
  ) and exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and item.item_id = spinach_item_id
  ) then
    raise exception 'Cannot split omelette item because both old and target item IDs exist.';
  end if;

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  values (spinach_pricing_key, 'variants', null)
  on conflict (pricing_key) do update
  set kind = excluded.kind,
      amount = excluded.amount;

  insert into menu_content.menu_price_variants (
    pricing_key,
    price_kind,
    variant_id,
    name,
    amount,
    available,
    order_index
  )
  select
    spinach_pricing_key,
    variant.price_kind,
    variant.variant_id,
    variant.name,
    variant.amount,
    variant.available,
    variant.order_index
  from menu_content.menu_price_variants variant
  where variant.pricing_key = old_pricing_key
  on conflict (pricing_key, variant_id) do update
  set name = excluded.name,
      amount = excluded.amount,
      available = excluded.available,
      order_index = excluded.order_index;

  if not exists (
    select 1
    from menu_content.menu_price_variants variant
    where variant.pricing_key = spinach_pricing_key
  ) then
    insert into menu_content.menu_price_variants (
      pricing_key,
      price_kind,
      variant_id,
      name,
      amount,
      available,
      order_index
    )
    values
      (spinach_pricing_key, 'variants', 'con-guarnicion', 'Con guarnicion', 10000, true, 0),
      (spinach_pricing_key, 'variants', 'sin-guarnicion', 'Sin guarnicion', 8000, true, 1);
  end if;

  update menu_content.menu_catalog_items item
  set item_id = spinach_item_id,
      name = 'Omelette de espinaca y muzzarella',
      pricing_key = spinach_pricing_key
  where item.section_id = target_section_id
    and item.item_id = old_item_id;

  update public.menu_availability_overlays overlay
  set item_id = spinach_item_id
  where overlay.section_id = target_section_id
    and overlay.item_id = old_item_id
    and not exists (
      select 1
      from public.menu_availability_overlays existing
      where existing.menu_id = overlay.menu_id
        and existing.section_id = overlay.section_id
        and existing.item_id = spinach_item_id
    );

  delete from public.menu_availability_overlays overlay
  where overlay.section_id = target_section_id
    and overlay.item_id = old_item_id;

  delete from menu_content.menu_prices price
  where price.pricing_key = old_pricing_key
    and not exists (
      select 1
      from menu_content.menu_catalog_items item
      where item.pricing_key = old_pricing_key
    );

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  values (ham_pricing_key, 'variants', null)
  on conflict (pricing_key) do update
  set kind = excluded.kind,
      amount = excluded.amount;

  insert into menu_content.menu_price_variants (
    pricing_key,
    price_kind,
    variant_id,
    name,
    amount,
    available,
    order_index
  )
  select
    ham_pricing_key,
    variant.price_kind,
    variant.variant_id,
    variant.name,
    variant.amount,
    variant.available,
    variant.order_index
  from menu_content.menu_price_variants variant
  where variant.pricing_key = spinach_pricing_key
  on conflict (pricing_key, variant_id) do update
  set name = excluded.name,
      amount = excluded.amount,
      available = excluded.available,
      order_index = excluded.order_index;

  insert into menu_content.menu_catalog_items (
    section_id,
    item_id,
    name,
    description,
    available,
    pricing_key,
    order_index
  )
  values (
    target_section_id,
    ham_item_id,
    'Omelette de jamon y queso',
    null,
    true,
    ham_pricing_key,
    coalesce((
      select max(item.order_index) + 1
      from menu_content.menu_catalog_items item
      where item.section_id = target_section_id
    ), 0)
  )
  on conflict (section_id, item_id) do update
  set name = excluded.name,
      description = excluded.description,
      available = excluded.available,
      pricing_key = excluded.pricing_key;
end $$;

commit;
