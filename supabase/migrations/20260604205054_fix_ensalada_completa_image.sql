begin;

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id in ('ensalada-completa', 'ensalada-tres-sabores');

  if matched <> 2 then
    raise exception
      'Expected ensalada-completa and ensalada-tres-sabores as direct catalog items before correcting images (found %).',
      matched;
  end if;
end $$;

update menu_content.menu_catalog_items item
set image_path = '/uploads/menu/ensalada-completa.webp'
where item.group_id = ''
  and item.item_id = 'ensalada-completa';

update menu_content.menu_catalog_items item
set image_path = null
where item.group_id = ''
  and item.item_id = 'ensalada-tres-sabores'
  and item.image_path = '/uploads/menu/ensalada-tres-sabores.webp';

commit;
