begin;

do $$
declare
  target_section_id constant text := 'tartas-tortillas-omelettes';
  spinach_item_id constant text := 'omelette-espinaca-muzzarella';
  ham_item_id constant text := 'omelette-jamon-queso';
  ham_catalog_item_id bigint;
begin
  select item.id
  into ham_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.item_id = ham_item_id;

  if ham_catalog_item_id is null then
    raise exception 'Cannot move omelette image because target item % does not exist.', ham_item_id;
  end if;

  delete from menu_content.menu_catalog_item_images image
  where image.catalog_item_id = ham_catalog_item_id
    and image.order_index = 0
    and image.image_path <> '/uploads/menu/omelette.webp';

  update menu_content.menu_catalog_item_images image
  set catalog_item_id = ham_catalog_item_id,
      order_index = 0
  where image.image_path = '/uploads/menu/omelette.webp'
    and exists (
      select 1
      from menu_content.menu_catalog_items item
      where item.id = image.catalog_item_id
        and item.section_id = target_section_id
        and item.item_id = spinach_item_id
    );
end $$;

commit;
