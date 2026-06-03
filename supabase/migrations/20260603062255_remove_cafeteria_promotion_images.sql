update menu_content.menu_catalog_items
set image_path = null
where section_id in ('desayuno-snack', 'promociones')
  and image_path is not null;
