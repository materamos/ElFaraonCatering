begin;

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id in ('cuarto-pollo', 'omelette', 'pechuga-grill');

  if matched <> 3 then
    raise exception
      'Expected cuarto-pollo, omelette and pechuga-grill as direct catalog items before setting images (found %).',
      matched;
  end if;
end $$;

with desired_images (item_id, image_path) as (
  values
    ('cuarto-pollo', '/uploads/menu/cuarto-pollo.webp'),
    ('omelette', '/uploads/menu/omelette.webp'),
    ('pechuga-grill', '/uploads/menu/pechuga-grill.webp')
)
update menu_content.menu_catalog_items item
set image_path = desired.image_path
from desired_images desired
where item.group_id = ''
  and item.item_id = desired.item_id;

commit;
