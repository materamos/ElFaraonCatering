begin;

do $$
declare
  matched_sections integer;
begin
  with desired_sections(section_id) as (
    values
      ('platos-principales'),
      ('minutas-tartas-omelettes'),
      ('guarniciones'),
      ('empanadas'),
      ('ensaladas'),
      ('desayuno-snack'),
      ('promociones'),
      ('bebidas')
  )
  select count(*)::integer
  into matched_sections
  from menu_content.menu_catalog_sections section
  join desired_sections desired
    on desired.section_id = section.section_id;

  if matched_sections <> 8 then
    raise exception 'Expected all catalog sections before normalizing order and text.';
  end if;
end $$;

with desired_sections(section_id, title, description, order_index) as (
  values
    ('platos-principales', 'Platos principales con guarnición', null::text, 0),
    ('minutas-tartas-omelettes', 'Tartas, tortillas y omelettes', 'Opciones rápidas con modalidades de guarnición cuando aplica.', 1),
    ('guarniciones', 'Guarniciones', 'Opciones de guarnición para platos y minutas.', 2),
    ('empanadas', 'Empanadas', null::text, 3),
    ('ensaladas', 'Ensaladas', null::text, 4),
    ('desayuno-snack', 'Cafetería', null::text, 5),
    ('promociones', 'Promociones cafetería', 'Combos vigentes del buffet.', 6),
    ('bebidas', 'Bebidas', null::text, 7)
)
update menu_content.menu_catalog_sections section
set
  title = desired.title,
  description = desired.description,
  order_index = desired.order_index
from desired_sections desired
where section.section_id = desired.section_id;

with desired_profiles(id, eyebrow, title, description, info_title) as (
  values
    (
      'corpo',
      'El Faraón Catering',
      'Menú Corpo',
      'Opciones del día, platos, minutas, promociones y bebidas para la operación del buffet de El Faraón Catering dentro del edificio corporativo de Teleinde.',
      'Información útil'
    ),
    (
      'teleinde',
      'El Faraón Catering',
      'Menú Teleinde',
      'Opciones del día, platos, minutas, promociones y bebidas para la operación del buffet de El Faraón Catering en los estudios de Teleinde.',
      'Información útil'
    )
)
update menu_content.menu_profiles profile
set
  eyebrow = desired.eyebrow,
  title = desired.title,
  description = desired.description,
  info_title = desired.info_title
from desired_profiles desired
where profile.id = desired.id;

with desired_facts(profile_id, fact_id, value) as (
  values
    ('corpo', 'disponibilidad', 'Puede variar durante el día.'),
    ('teleinde', 'disponibilidad', 'Puede variar durante el día.'),
    ('corpo', 'pagos', 'Efectivo, Mercado Pago, Modo, Tarjeta crédito, Tarjeta débito'),
    ('teleinde', 'pagos', 'Efectivo, Mercado Pago, Modo, Tarjeta crédito, Tarjeta débito')
)
update menu_content.menu_profile_facts fact
set value = desired.value
from desired_facts desired
where fact.profile_id = desired.profile_id
  and fact.fact_id = desired.fact_id;

with desired_daily_items(item_id, name) as (
  values
    ('menu-del-dia', 'Filet de merluza rebozado'),
    ('menu-vegetariano-del-dia', 'Milanesa de calabaza a la napolitana')
)
update menu_content.menu_daily_items item
set name = desired.name
from desired_daily_items desired
where item.item_id = desired.item_id;

with desired_catalog_items(section_id, group_id, item_id, name, description) as (
  values
    ('bebidas', '', 'cunnington-tonica', 'Cunnington Tónica', null::text),
    ('bebidas', '', 'cunnington-tonica-zero', 'Cunnington Tónica Zero', null::text),
    ('desayuno-snack', '', 'cafe-frio', 'Café frío', null::text),
    ('desayuno-snack', '', 'te', 'Té clásico', null::text),
    ('desayuno-snack', '', 'medialuna-jamon-queso', 'Medialuna con jamón y queso', null::text),
    ('empanadas', '', 'empanadas', 'Empanadas', 'Elegí el sabor.'),
    ('ensaladas', '', 'ensalada-el-faraon', 'El Faraón', 'Lechuga, tomate, zanahoria, jamón, queso y huevo.'),
    ('guarniciones', '', 'pure-papa', 'Puré', 'Puede ser mixto o simple. Sujeto a disponibilidad
Papa - batata - calabaza'),
    ('guarniciones', '', 'papas-fritas', 'Papas fritas', null::text),
    ('guarniciones', '', 'guarnicion-sola', 'Guarnición sola', null::text),
    ('minutas-tartas-omelettes', '', 'tartas', 'Tartas', 'Elegí el sabor y la modalidad.'),
    ('promociones', '', 'cafe-leche-mediano-dos-medialunas', 'Café con leche mediano + dos medialunas', null::text),
    ('promociones', '', 'cafe-leche-tostado-clasico', 'Café con leche + tostado clásico', null::text),
    ('promociones', '', 'cafe-leche-tostadas', 'Café con leche + tostadas con queso crema y mermelada', null::text),
    ('promociones', '', 'licuado-tostado-clasico', 'Licuado + tostado clásico', null::text)
)
update menu_content.menu_catalog_items item
set
  name = desired.name,
  description = case
    when desired.description is null then item.description
    else desired.description
  end
from desired_catalog_items desired
where item.section_id = desired.section_id
  and item.group_id = desired.group_id
  and item.item_id = desired.item_id;

with desired_catalog_options(section_id, group_id, item_id, option_id, name) as (
  values
    ('empanadas', '', 'empanadas', 'jamon-queso', 'Jamón y queso'),
    ('minutas-tartas-omelettes', '', 'tartas', 'jamon-queso', 'Jamón y queso'),
    ('minutas-tartas-omelettes', '', 'tartas', 'jamon-verdeo', 'Jamón y verdeo'),
    ('minutas-tartas-omelettes', '', 'tartas', 'brocoli', 'Brócoli')
)
update menu_content.menu_catalog_item_options option
set name = desired.name
from desired_catalog_options desired
join menu_content.menu_catalog_items item
  on item.section_id = desired.section_id
 and item.group_id = desired.group_id
 and item.item_id = desired.item_id
where option.catalog_item_id = item.id
  and option.option_id = desired.option_id;

with desired_price_variants(pricing_key, variant_id, name) as (
  values
    ('catalog:minutas-tartas-omelettes:item:omelette:price', 'con-guarnicion', 'Con guarnición'),
    ('catalog:minutas-tartas-omelettes:item:omelette:price', 'sin-guarnicion', 'Sin guarnición'),
    ('catalog:minutas-tartas-omelettes:item:tartas:price', 'con-guarnicion', 'Con guarnición'),
    ('catalog:minutas-tartas-omelettes:item:tartas:price', 'sin-guarnicion', 'Sin guarnición'),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'con-cebolla-con-guarnicion', 'Con cebolla con guarnición'),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-cebolla-con-guarnicion', 'Sin cebolla con guarnición'),
    ('catalog:minutas-tartas-omelettes:item:tortilla:price', 'sin-guarnicion', 'Sin guarnición')
)
update menu_content.menu_price_variants variant
set name = desired.name
from desired_price_variants desired
where variant.pricing_key = desired.pricing_key
  and variant.variant_id = desired.variant_id;

with desired_grill_families(family_id, title) as (
  values
    ('choripan', 'Choripán'),
    ('entrana', 'Entraña')
)
update menu_content.menu_grill_families family
set title = desired.title
from desired_grill_families desired
where family.family_id = desired.family_id;

with desired_grill_items(item_id, name, variant_name) as (
  values
    ('parrilla-choripan-guarnicion', 'Choripán con guarnición', 'Con guarnición'),
    ('parrilla-hamburguesa-completa-guarnicion', 'Hamburguesa completa con guarnición', 'Completa con guarnición'),
    ('parrilla-sandwich-bondiola-completo', 'Sándwich de bondiola completo', 'Sándwich completo'),
    ('parrilla-sandwich-bondiola-guarnicion', 'Sándwich de bondiola con guarnición', 'Sándwich con guarnición'),
    ('parrilla-bondiola-plato-guarnicion', 'Bondiola al plato con guarnición', 'Al plato con guarnición'),
    ('parrilla-matambre-pizza-guarnicion', 'Matambre a la pizza con guarnición', 'A la pizza con guarnición'),
    ('parrilla-matambre-fugazzeta-guarnicion', 'Matambre a la fugazzeta con guarnición', 'A la fugazzeta con guarnición'),
    ('parrilla-sandwich-entrana-completo', 'Sándwich de entraña completo', 'Sándwich completo'),
    ('parrilla-sandwich-entrana-guarnicion', 'Sándwich de entraña completa con guarnición', 'Sándwich completo con guarnición'),
    ('parrilla-entrana-plato-guarnicion', 'Entraña al plato con guarnición', 'Al plato con guarnición'),
    ('parrilla-sandwich-lomo-completo', 'Sándwich de lomo completo', 'Sándwich completo'),
    ('parrilla-sandwich-lomo-guarnicion', 'Sándwich de lomo completo con guarnición', 'Sándwich completo con guarnición'),
    ('parrilla-lomo-plato-guarnicion', 'Lomo al plato con guarnición', 'Al plato con guarnición'),
    ('parrilla-sandwich-bife-chorizo-completo', 'Sándwich de bife de chorizo completo', 'Sándwich completo'),
    ('parrilla-sandwich-bife-chorizo-guarnicion', 'Sándwich de bife de chorizo completo con guarnición', 'Sándwich completo con guarnición'),
    ('parrilla-bife-chorizo-plato-guarnicion', 'Bife de chorizo al plato con guarnición', 'Al plato con guarnición')
)
update menu_content.menu_grill_catalog_items item
set
  name = desired.name,
  variant_name = desired.variant_name
from desired_grill_items desired
where item.item_id = desired.item_id;

commit;
