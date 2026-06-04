begin;

-- Asigna las fotos reales (webp build-time bajo /uploads/menu/) a los tres
-- platos fotografiados, reemplazando sus placeholders por foto real.
-- Se matchea por item_id porque es estable e inequivoco para estos tres items,
-- independiente del id de seccion vigente en la base.

do $$
declare
  matched integer;
begin
  select count(*)
  into matched
  from menu_content.menu_catalog_items
  where group_id = ''
    and item_id in ('milanesa-peceto', 'pure-papa', 'tortilla');

  if matched <> 3 then
    raise exception
      'Expected milanesa-peceto, pure-papa and tortilla as direct catalog items before setting images (found %).',
      matched;
  end if;
end $$;

with desired_images (item_id, image_path) as (
  values
    ('milanesa-peceto', '/uploads/menu/milanesa-peceto.webp'),
    ('pure-papa', '/uploads/menu/pure-papa.webp'),
    ('tortilla', '/uploads/menu/tortilla.webp')
)
update menu_content.menu_catalog_items item
set image_path = desired.image_path
from desired_images desired
where item.group_id = ''
  and item.item_id = desired.item_id;

commit;
