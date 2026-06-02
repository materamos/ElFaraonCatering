begin;

do $$
declare
  matched_side_count integer;
  matched_main_count integer;
begin
  with desired_side_order (item_id, new_order_index) as (
    values
      ('pure-papa', 0),
      ('papas-fritas', 1),
      ('ensalada-tres-sabores', 2),
      ('chips', 3),
      ('guarnicion-sola', 4)
  )
  select count(*)
  into matched_side_count
  from menu_content.menu_catalog_items item
  join desired_side_order desired
    on desired.item_id = item.item_id
  where item.section_id = 'guarniciones'
    and item.group_id = '';

  if matched_side_count <> 5 then
    raise exception 'Expected all guarniciones items before reordering.';
  end if;

  with desired_main_order (item_id, new_order_index) as (
    values
      ('milanesa-peceto', 0),
      ('milanesa-napolitana', 1),
      ('suprema-pollo', 2),
      ('suprema-de-pollo-napolitana', 3),
      ('cuarto-pollo', 4),
      ('pechuga-grill', 5)
  )
  select count(*)
  into matched_main_count
  from menu_content.menu_catalog_items item
  join desired_main_order desired
    on desired.item_id = item.item_id
  where item.section_id = 'platos-principales'
    and item.group_id = '';

  if matched_main_count <> 6 then
    raise exception 'Expected all platos principales items before reordering.';
  end if;
end $$;

with desired_order (section_id, item_id, new_order_index) as (
  values
    ('guarniciones', 'pure-papa', 0),
    ('guarniciones', 'papas-fritas', 1),
    ('guarniciones', 'ensalada-tres-sabores', 2),
    ('guarniciones', 'chips', 3),
    ('guarniciones', 'guarnicion-sola', 4),
    ('platos-principales', 'milanesa-peceto', 0),
    ('platos-principales', 'milanesa-napolitana', 1),
    ('platos-principales', 'suprema-pollo', 2),
    ('platos-principales', 'suprema-de-pollo-napolitana', 3),
    ('platos-principales', 'cuarto-pollo', 4),
    ('platos-principales', 'pechuga-grill', 5)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index + 1000
from desired_order desired
where item.section_id = desired.section_id
  and item.group_id = ''
  and item.item_id = desired.item_id;

with desired_order (section_id, item_id, new_order_index) as (
  values
    ('guarniciones', 'pure-papa', 0),
    ('guarniciones', 'papas-fritas', 1),
    ('guarniciones', 'ensalada-tres-sabores', 2),
    ('guarniciones', 'chips', 3),
    ('guarniciones', 'guarnicion-sola', 4),
    ('platos-principales', 'milanesa-peceto', 0),
    ('platos-principales', 'milanesa-napolitana', 1),
    ('platos-principales', 'suprema-pollo', 2),
    ('platos-principales', 'suprema-de-pollo-napolitana', 3),
    ('platos-principales', 'cuarto-pollo', 4),
    ('platos-principales', 'pechuga-grill', 5)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index
from desired_order desired
where item.section_id = desired.section_id
  and item.group_id = ''
  and item.item_id = desired.item_id;

commit;
