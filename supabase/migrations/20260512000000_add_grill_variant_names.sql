alter table menu_content.menu_grill_catalog_items
  add column if not exists variant_name text null;

with grill_variant_names (item_id, variant_name) as (
  values
    ('parrilla-choripan', 'Simple'),
    ('parrilla-choripan-guarnicion', 'Con guarnicion'),
    ('parrilla-hamburguesa-completa', 'Completa'),
    ('parrilla-hamburguesa-completa-guarnicion', 'Completa con guarnicion'),
    ('parrilla-sandwich-bondiola-completo', 'Sandwich completo'),
    ('parrilla-sandwich-bondiola-guarnicion', 'Sandwich con guarnicion'),
    ('parrilla-bondiola-plato-guarnicion', 'Al plato con guarnicion'),
    ('parrilla-matambre-pizza-guarnicion', 'A la pizza con guarnicion'),
    ('parrilla-matambre-fugazzeta-guarnicion', 'A la fugazzeta con guarnicion'),
    ('parrilla-sandwich-entrana-completo', 'Sandwich completo'),
    ('parrilla-sandwich-entrana-guarnicion', 'Sandwich completo con guarnicion'),
    ('parrilla-entrana-plato-guarnicion', 'Al plato con guarnicion'),
    ('parrilla-sandwich-lomo-completo', 'Sandwich completo'),
    ('parrilla-sandwich-lomo-guarnicion', 'Sandwich completo con guarnicion'),
    ('parrilla-lomo-plato-guarnicion', 'Al plato con guarnicion'),
    ('parrilla-sandwich-bife-chorizo-completo', 'Sandwich completo'),
    ('parrilla-sandwich-bife-chorizo-guarnicion', 'Sandwich completo con guarnicion'),
    ('parrilla-bife-chorizo-plato-guarnicion', 'Al plato con guarnicion')
)
update menu_content.menu_grill_catalog_items target
set variant_name = grill_variant_names.variant_name
from grill_variant_names
where target.item_id = grill_variant_names.item_id;
