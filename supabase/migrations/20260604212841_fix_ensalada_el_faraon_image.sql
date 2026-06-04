begin;

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id in ('ensalada-completa', 'ensalada-el-faraon');

  if matched <> 2 then
    raise exception
      'Expected ensalada-completa and ensalada-el-faraon as direct catalog items before correcting images (found %).',
      matched;
  end if;
end $$;

update menu_content.menu_catalog_items item
set image_path = '/uploads/menu/ensalada-el-faraon.webp'
where item.group_id = ''
  and item.item_id = 'ensalada-el-faraon';

update menu_content.menu_catalog_items item
set image_path = null
where item.group_id = ''
  and item.item_id = 'ensalada-completa'
  and item.image_path = '/uploads/menu/ensalada-completa.webp';

commit;
