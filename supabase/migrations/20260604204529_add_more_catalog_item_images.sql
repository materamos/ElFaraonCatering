begin;

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id in (
      'empanadas',
      'ensalada-caesar',
      'ensalada-completa-pollo',
      'ensalada-tres-sabores',
      'suprema-pollo',
      'tartas'
    );

  if matched <> 6 then
    raise exception
      'Expected empanadas, ensalada-caesar, ensalada-completa-pollo, ensalada-tres-sabores, suprema-pollo and tartas as direct catalog items before setting images (found %).',
      matched;
  end if;
end $$;

with desired_primary_images (item_id, image_path) as (
  values
    ('empanadas', '/uploads/menu/empanadas.webp'),
    ('ensalada-caesar', '/uploads/menu/ensalada-caesar.webp'),
    ('ensalada-completa-pollo', '/uploads/menu/ensalada-completa-pollo.webp'),
    ('ensalada-tres-sabores', '/uploads/menu/ensalada-tres-sabores.webp'),
    ('suprema-pollo', '/uploads/menu/suprema-pollo.webp'),
    ('tartas', '/uploads/menu/tartas-2.webp')
)
update menu_content.menu_catalog_items item
set image_path = desired.image_path
from desired_primary_images desired
where item.group_id = ''
  and item.item_id = desired.item_id;

with desired_additional_images (item_id, image_path, order_index) as (
  values
    ('empanadas', '/uploads/menu/empanadas-3.webp', 1),
    ('tartas', '/uploads/menu/tartas.webp', 1),
    ('tartas', '/uploads/menu/tartas-3.webp', 2)
)
insert into menu_content.menu_catalog_item_images (
  catalog_item_id,
  image_path,
  order_index
)
select
  item.id,
  desired.image_path,
  desired.order_index
from desired_additional_images desired
join menu_content.menu_catalog_items item
  on item.group_id = ''
 and item.item_id = desired.item_id
on conflict (catalog_item_id, image_path)
do update set order_index = excluded.order_index;

commit;
