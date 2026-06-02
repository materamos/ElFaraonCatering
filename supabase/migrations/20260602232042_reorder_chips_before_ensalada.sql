begin;

do $$
declare
  matched_count integer;
begin
  with desired_order (item_id, new_order_index) as (
    values
      ('pure-papa', 0),
      ('papas-fritas', 1),
      ('chips', 2),
      ('ensalada-tres-sabores', 3),
      ('guarnicion-sola', 4)
  )
  select count(*)
  into matched_count
  from menu_content.menu_catalog_items item
  join desired_order desired
    on desired.item_id = item.item_id
  where item.section_id = 'guarniciones'
    and item.group_id = '';

  if matched_count <> 5 then
    raise exception 'Expected all guarniciones items before reordering.';
  end if;
end $$;

with desired_order (item_id, new_order_index) as (
  values
    ('pure-papa', 0),
    ('papas-fritas', 1),
    ('chips', 2),
    ('ensalada-tres-sabores', 3),
    ('guarnicion-sola', 4)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index + 1000
from desired_order desired
where item.section_id = 'guarniciones'
  and item.group_id = ''
  and item.item_id = desired.item_id;

with desired_order (item_id, new_order_index) as (
  values
    ('pure-papa', 0),
    ('papas-fritas', 1),
    ('chips', 2),
    ('ensalada-tres-sabores', 3),
    ('guarnicion-sola', 4)
)
update menu_content.menu_catalog_items item
set order_index = desired.new_order_index
from desired_order desired
where item.section_id = 'guarniciones'
  and item.group_id = ''
  and item.item_id = desired.item_id;

commit;
