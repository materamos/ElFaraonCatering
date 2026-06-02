begin;

do $$
declare
  matched_count integer;
begin
  with desired_order (item_id, new_order_index) as (
    values
      ('cafe-leche-mediano-dos-medialunas', 0),
      ('cafe-leche-tostado-clasico', 1),
      ('cafe-leche-tostadas', 2),
      ('cafe-con-leche-mediano-huevos-revueltos', 3),
      ('yogur-cereales-barrita', 4),
      ('jarrito-exprimido-dos-medialunas', 5),
      ('licuado-tostado-clasico', 6)
  )
  select count(*)
  into matched_count
  from menu_content.menu_catalog_items item
  join desired_order desired
    on desired.item_id = item.item_id
  where item.section_id = 'promociones'
    and item.group_id = '';

  if matched_count <> 7 then
    raise exception 'Expected all promociones items before reordering.';
  end if;
end $$;

with desired_order (item_id, new_order_index) as (
  values
    ('cafe-leche-mediano-dos-medialunas', 0),
    ('cafe-leche-tostado-clasico', 1),
    ('cafe-leche-tostadas', 2),
    ('cafe-con-leche-mediano-huevos-revueltos', 3),
    ('yogur-cereales-barrita', 4),
    ('jarrito-exprimido-dos-medialunas', 5),
    ('licuado-tostado-clasico', 6)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index + 1000
from desired_order desired
where item.section_id = 'promociones'
  and item.group_id = ''
  and item.item_id = desired.item_id;

with desired_order (item_id, new_order_index) as (
  values
    ('cafe-leche-mediano-dos-medialunas', 0),
    ('cafe-leche-tostado-clasico', 1),
    ('cafe-leche-tostadas', 2),
    ('cafe-con-leche-mediano-huevos-revueltos', 3),
    ('yogur-cereales-barrita', 4),
    ('jarrito-exprimido-dos-medialunas', 5),
    ('licuado-tostado-clasico', 6)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index
from desired_order desired
where item.section_id = 'promociones'
  and item.group_id = ''
  and item.item_id = desired.item_id;

commit;
