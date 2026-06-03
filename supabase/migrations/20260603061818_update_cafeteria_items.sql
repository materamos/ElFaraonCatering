with removed_items(item_id) as (
  values
    ('ensalada-fruta'),
    ('fruta-fresca'),
    ('licuado-banana')
),
removed_prices(pricing_key) as (
  select pricing_key
  from menu_content.menu_catalog_items
  where section_id = 'desayuno-snack'
    and group_id = ''
    and item_id in (select item_id from removed_items)
)
delete from menu_content.menu_catalog_items
where section_id = 'desayuno-snack'
  and group_id = ''
  and item_id in (select item_id from removed_items);

delete from menu_content.menu_prices
where pricing_key in (
  'catalog:desayuno-snack:item:ensalada-fruta:price',
  'catalog:desayuno-snack:item:fruta-fresca:price',
  'catalog:desayuno-snack:item:licuado-banana:price'
)
and not exists (
  select 1
  from menu_content.menu_catalog_items item
  where item.pricing_key = menu_content.menu_prices.pricing_key
);

with final_items(item_id, item_name, order_index) as (
  values
    ('cafe-chico', 'Café chico', 0),
    ('cafe-mediano', 'Café mediano', 1),
    ('cafe-grande', 'Café grande', 2),
    ('cafe-frio', 'Café frio', 3),
    ('licuado-frutas', 'Licuado de frutas o banana', 4),
    ('te', 'Té', 5),
    ('mate-cocido', 'Mate cocido', 6),
    ('exprimido-naranja', 'Exprimido de naranja', 7),
    ('yogur-cereal', 'Yogurt con cereales', 8),
    ('yogur-descremado', 'Yogurt sin cereales o con colchón', 9),
    ('medialunas-manteca', 'Medialuna', 10),
    ('tostadas-queso-crema-mermelada', 'Tostadas con queso crema y mermelada', 11),
    ('medialuna-jamon-queso', 'Medialuna con jamon y queso', 12),
    ('arabe-miga-jamon-queso', 'Árabe/miga jamón y queso', 13),
    ('arabe-jamon-queso-tomate', 'Árabe jamón, queso y tomate', 14),
    ('arabe-jamon-queso-tomate-huevo', 'Árabe jamón, queso, tomate y huevo', 15),
    ('baguetin-jamon-queso', 'Baguetin de jamón y queso', 16),
    ('baguetin-salame', 'Baguetin salame', 17),
    ('huevos-revueltos-tostadas', 'Huevos revueltos con tostadas', 18)
),
final_prices(pricing_key) as (
  select 'catalog:desayuno-snack:item:' || item_id || ':price'
  from final_items
)
insert into menu_content.menu_prices (pricing_key, kind, amount)
select pricing_key, 'fixed', 9999
from final_prices
on conflict (pricing_key) do nothing;

update menu_content.menu_catalog_items
set order_index = order_index + 1000
where section_id = 'desayuno-snack'
  and group_id = '';

with final_items(item_id, item_name, order_index) as (
  values
    ('cafe-chico', 'Café chico', 0),
    ('cafe-mediano', 'Café mediano', 1),
    ('cafe-grande', 'Café grande', 2),
    ('cafe-frio', 'Café frio', 3),
    ('licuado-frutas', 'Licuado de frutas o banana', 4),
    ('te', 'Té', 5),
    ('mate-cocido', 'Mate cocido', 6),
    ('exprimido-naranja', 'Exprimido de naranja', 7),
    ('yogur-cereal', 'Yogurt con cereales', 8),
    ('yogur-descremado', 'Yogurt sin cereales o con colchón', 9),
    ('medialunas-manteca', 'Medialuna', 10),
    ('tostadas-queso-crema-mermelada', 'Tostadas con queso crema y mermelada', 11),
    ('medialuna-jamon-queso', 'Medialuna con jamon y queso', 12),
    ('arabe-miga-jamon-queso', 'Árabe/miga jamón y queso', 13),
    ('arabe-jamon-queso-tomate', 'Árabe jamón, queso y tomate', 14),
    ('arabe-jamon-queso-tomate-huevo', 'Árabe jamón, queso, tomate y huevo', 15),
    ('baguetin-jamon-queso', 'Baguetin de jamón y queso', 16),
    ('baguetin-salame', 'Baguetin salame', 17),
    ('huevos-revueltos-tostadas', 'Huevos revueltos con tostadas', 18)
),
missing_items as (
  select
    final_items.*,
    row_number() over (order by final_items.order_index) as missing_index
  from final_items
  where not exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = 'desayuno-snack'
      and item.group_id = ''
      and item.item_id = final_items.item_id
  )
),
id_base as (
  select coalesce(max(id), 0) as max_id
  from menu_content.menu_catalog_items
)
insert into menu_content.menu_catalog_items (
  id,
  section_id,
  group_id,
  item_id,
  name,
  description,
  image_path,
  available,
  pricing_key,
  order_index
)
select
  id_base.max_id + missing_items.missing_index,
  'desayuno-snack',
  '',
  missing_items.item_id,
  missing_items.item_name,
  null,
  '/uploads/menu-placeholders/desayuno-snack.svg',
  true,
  'catalog:desayuno-snack:item:' || missing_items.item_id || ':price',
  2000 + missing_items.order_index
from missing_items
cross join id_base;

with final_items(item_id, item_name, order_index) as (
  values
    ('cafe-chico', 'Café chico', 0),
    ('cafe-mediano', 'Café mediano', 1),
    ('cafe-grande', 'Café grande', 2),
    ('cafe-frio', 'Café frio', 3),
    ('licuado-frutas', 'Licuado de frutas o banana', 4),
    ('te', 'Té', 5),
    ('mate-cocido', 'Mate cocido', 6),
    ('exprimido-naranja', 'Exprimido de naranja', 7),
    ('yogur-cereal', 'Yogurt con cereales', 8),
    ('yogur-descremado', 'Yogurt sin cereales o con colchón', 9),
    ('medialunas-manteca', 'Medialuna', 10),
    ('tostadas-queso-crema-mermelada', 'Tostadas con queso crema y mermelada', 11),
    ('medialuna-jamon-queso', 'Medialuna con jamon y queso', 12),
    ('arabe-miga-jamon-queso', 'Árabe/miga jamón y queso', 13),
    ('arabe-jamon-queso-tomate', 'Árabe jamón, queso y tomate', 14),
    ('arabe-jamon-queso-tomate-huevo', 'Árabe jamón, queso, tomate y huevo', 15),
    ('baguetin-jamon-queso', 'Baguetin de jamón y queso', 16),
    ('baguetin-salame', 'Baguetin salame', 17),
    ('huevos-revueltos-tostadas', 'Huevos revueltos con tostadas', 18)
)
update menu_content.menu_catalog_items item
set
  name = final_items.item_name,
  pricing_key = 'catalog:desayuno-snack:item:' || final_items.item_id || ':price',
  order_index = final_items.order_index,
  image_path = coalesce(item.image_path, '/uploads/menu-placeholders/desayuno-snack.svg'),
  available = true
from final_items
where item.section_id = 'desayuno-snack'
  and item.group_id = ''
  and item.item_id = final_items.item_id;
