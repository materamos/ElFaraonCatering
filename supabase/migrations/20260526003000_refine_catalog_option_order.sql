begin;

do $$
declare
  matched_option_count integer;
  matched_variant_count integer;
begin
  with desired_option_order (item_id, option_id, new_order_index) as (
    values
      ('tartas', 'jamon-queso', 0),
      ('tartas', 'jamon-verdeo', 1),
      ('tartas', 'pollo-puerro', 2),
      ('tartas', 'calabaza-muzarella', 3),
      ('tartas', 'verdura', 4),
      ('tartas', 'brocoli', 5),
      ('empanadas', 'carne', 0),
      ('empanadas', 'jamon-queso', 1),
      ('empanadas', 'pollo-barbacoa', 2),
      ('empanadas', 'bondiola-mostaza', 3),
      ('empanadas', 'verdura', 4),
      ('empanadas', 'caprese', 5)
  )
  select count(*)
  into matched_option_count
  from menu_content.menu_catalog_item_options option
  join menu_content.menu_catalog_items item
    on item.id = option.catalog_item_id
  join desired_option_order desired
    on desired.item_id = item.item_id
   and desired.option_id = option.option_id;

  if matched_option_count <> 12 then
    raise exception 'Expected all catalog options before reordering.';
  end if;

  with desired_variant_order (pricing_key, variant_id, new_order_index) as (
    values
      ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'con-cebolla-con-guarnicion', 0),
      ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-cebolla-con-guarnicion', 1),
      ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-guarnicion', 2)
  )
  select count(*)
  into matched_variant_count
  from menu_content.menu_price_variants variant
  join desired_variant_order desired
    on desired.pricing_key = variant.pricing_key
   and desired.variant_id = variant.variant_id;

  if matched_variant_count <> 3 then
    raise exception 'Expected all tortilla variants before reordering.';
  end if;
end $$;

with desired_option_order (item_id, option_id, new_order_index) as (
  values
    ('tartas', 'jamon-queso', 0),
    ('tartas', 'jamon-verdeo', 1),
    ('tartas', 'pollo-puerro', 2),
    ('tartas', 'calabaza-muzarella', 3),
    ('tartas', 'verdura', 4),
    ('tartas', 'brocoli', 5),
    ('empanadas', 'carne', 0),
    ('empanadas', 'jamon-queso', 1),
    ('empanadas', 'pollo-barbacoa', 2),
    ('empanadas', 'bondiola-mostaza', 3),
    ('empanadas', 'verdura', 4),
    ('empanadas', 'caprese', 5)
)
update menu_content.menu_catalog_item_options option
set order_index = desired.new_order_index + 1000
from menu_content.menu_catalog_items item,
  desired_option_order desired
where item.id = option.catalog_item_id
  and item.item_id = desired.item_id
  and option.option_id = desired.option_id;

with desired_option_order (item_id, option_id, new_order_index) as (
  values
    ('tartas', 'jamon-queso', 0),
    ('tartas', 'jamon-verdeo', 1),
    ('tartas', 'pollo-puerro', 2),
    ('tartas', 'calabaza-muzarella', 3),
    ('tartas', 'verdura', 4),
    ('tartas', 'brocoli', 5),
    ('empanadas', 'carne', 0),
    ('empanadas', 'jamon-queso', 1),
    ('empanadas', 'pollo-barbacoa', 2),
    ('empanadas', 'bondiola-mostaza', 3),
    ('empanadas', 'verdura', 4),
    ('empanadas', 'caprese', 5)
)
update menu_content.menu_catalog_item_options option
set order_index = desired.new_order_index
from menu_content.menu_catalog_items item,
  desired_option_order desired
where item.id = option.catalog_item_id
  and item.item_id = desired.item_id
  and option.option_id = desired.option_id;

with desired_variant_order (pricing_key, variant_id, new_order_index) as (
  values
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'con-cebolla-con-guarnicion', 0),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-cebolla-con-guarnicion', 1),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-guarnicion', 2)
)
update menu_content.menu_price_variants variant
set order_index = desired.new_order_index + 1000
from desired_variant_order desired
where variant.pricing_key = desired.pricing_key
  and variant.variant_id = desired.variant_id;

with desired_variant_order (pricing_key, variant_id, new_order_index) as (
  values
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'con-cebolla-con-guarnicion', 0),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-cebolla-con-guarnicion', 1),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-guarnicion', 2)
)
update menu_content.menu_price_variants variant
set order_index = desired.new_order_index
from desired_variant_order desired
where variant.pricing_key = desired.pricing_key
  and variant.variant_id = desired.variant_id;

commit;
