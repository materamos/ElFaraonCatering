delete from menu_content.menu_grill_families family
where family.family_id = 'otros'
  and not exists (
    select 1
    from menu_content.menu_grill_catalog_items item
    where item.family_id = family.family_id
  );
