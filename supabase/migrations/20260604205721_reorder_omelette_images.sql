begin;

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id = 'omelette';

  if matched <> 1 then
    raise exception
      'Expected omelette as one direct catalog item before setting images (found %).',
      matched;
  end if;
end $$;

update menu_content.menu_catalog_items item
set image_path = '/uploads/menu/omelette-2.webp'
where item.group_id = ''
  and item.item_id = 'omelette';

insert into menu_content.menu_catalog_item_images (
  catalog_item_id,
  image_path,
  order_index
)
select
  item.id,
  '/uploads/menu/omelette.webp',
  1
from menu_content.menu_catalog_items item
where item.group_id = ''
  and item.item_id = 'omelette'
on conflict (catalog_item_id, image_path)
do update set order_index = excluded.order_index;

commit;
