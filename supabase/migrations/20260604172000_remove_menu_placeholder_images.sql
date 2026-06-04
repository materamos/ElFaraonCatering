update menu_content.menu_catalog_items
set image_path = null
where image_path like '/uploads/menu-placeholders/%';

update menu_content.menu_grill_catalog_items
set image_path = null
where image_path like '/uploads/menu-placeholders/%';
