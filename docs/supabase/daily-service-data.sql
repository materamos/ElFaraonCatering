-- Idempotent data patch for the active flat daily-service model.
-- Run after docs/supabase/schema.sql.
-- Operational CMS edits to these rows are build-time data and require rebuild/deploy.

insert into menu_content.menu_prices (pricing_key, kind, amount)
values
  ('menu-del-dia', 'fixed', 7500),
  ('menu-del-dia-con-bebida', 'fixed', 9900),
  ('menu-vegetariano-del-dia', 'fixed', 7500),
  ('menu-vegetariano-del-dia-con-bebida', 'fixed', 9900)
on conflict (pricing_key) do nothing;

insert into menu_content.menu_daily_items (
  item_id,
  name,
  description,
  note,
  available,
  pricing_key,
  order_index
)
values
  ('menu-del-dia', 'Menu del dia', null, null, true, 'menu-del-dia', 0),
  ('menu-del-dia-con-bebida', 'Menu del dia + bebida', null, null, true, 'menu-del-dia-con-bebida', 1),
  ('menu-vegetariano-del-dia', 'Menu del dia vegetariano', null, null, true, 'menu-vegetariano-del-dia', 2),
  ('menu-vegetariano-del-dia-con-bebida', 'Menu del dia vegetariano + bebida', null, null, true, 'menu-vegetariano-del-dia-con-bebida', 3)
on conflict (item_id) do nothing;

with settings (profile_id, service_kind) as (
  values
    ('corpo', 'daily-menu'),
    ('teleinde', 'daily-menu')
)
insert into menu_content.menu_profile_service_settings (
  profile_id,
  service_kind
)
select
  profile_id,
  service_kind
from settings
on conflict (profile_id) do nothing;

insert into menu_content.menu_grill_families (
  family_id,
  title,
  order_index
)
values
  ('choripan', 'Choripan', 0),
  ('hamburguesa', 'Hamburguesa', 1),
  ('bondiola', 'Bondiola', 2),
  ('matambre', 'Matambre', 3),
  ('entrana', 'Entrana', 4),
  ('lomo', 'Lomo', 5),
  ('bife-chorizo', 'Bife de chorizo', 6),
  ('otros', 'Otros', 7)
on conflict (family_id) do nothing;

with grill_items (
  family_id,
  item_id,
  name,
  pricing_key,
  amount,
  order_index
) as (
  values
    ('choripan', 'parrilla-choripan', 'Choripan', 'parrilla-choripan', 7000, 0),
    ('choripan', 'parrilla-choripan-guarnicion', 'Choripan con guarnicion', 'parrilla-choripan-guarnicion', 9500, 1),
    ('hamburguesa', 'parrilla-hamburguesa-completa', 'Hamburguesa completa', 'parrilla-hamburguesa-completa', 10000, 2),
    ('hamburguesa', 'parrilla-hamburguesa-completa-guarnicion', 'Hamburguesa completa con guarnicion', 'parrilla-hamburguesa-completa-guarnicion', 13000, 3),
    ('bondiola', 'parrilla-sandwich-bondiola-completo', 'Sandwich de bondiola completo', 'parrilla-sandwich-bondiola-completo', 13000, 4),
    ('bondiola', 'parrilla-sandwich-bondiola-guarnicion', 'Sandwich de bondiola con guarnicion', 'parrilla-sandwich-bondiola-guarnicion', 15000, 5),
    ('bondiola', 'parrilla-bondiola-plato-guarnicion', 'Bondiola al plato con guarnicion', 'parrilla-bondiola-plato-guarnicion', 16000, 6),
    ('matambre', 'parrilla-matambre-pizza-guarnicion', 'Matambre a la pizza con guarnicion', 'parrilla-matambre-pizza-guarnicion', 17000, 7),
    ('matambre', 'parrilla-matambre-fugazzeta-guarnicion', 'Matambre a la fugazzeta con guarnicion', 'parrilla-matambre-fugazzeta-guarnicion', 17000, 8),
    ('entrana', 'parrilla-sandwich-entrana-completo', 'Sandwich de entrana completo', 'parrilla-sandwich-entrana-completo', 19000, 9),
    ('entrana', 'parrilla-sandwich-entrana-guarnicion', 'Sandwich de entrana completa con guarnicion', 'parrilla-sandwich-entrana-guarnicion', 22000, 10),
    ('entrana', 'parrilla-entrana-plato-guarnicion', 'Entrana al plato con guarnicion', 'parrilla-entrana-plato-guarnicion', 23000, 11),
    ('lomo', 'parrilla-sandwich-lomo-completo', 'Sandwich de lomo completo', 'parrilla-sandwich-lomo-completo', 20000, 12),
    ('lomo', 'parrilla-sandwich-lomo-guarnicion', 'Sandwich de lomo completo con guarnicion', 'parrilla-sandwich-lomo-guarnicion', 23000, 13),
    ('lomo', 'parrilla-lomo-plato-guarnicion', 'Lomo al plato con guarnicion', 'parrilla-lomo-plato-guarnicion', 24000, 14),
    ('bife-chorizo', 'parrilla-sandwich-bife-chorizo-completo', 'Sandwich de bife de chorizo completo', 'parrilla-sandwich-bife-chorizo-completo', 19000, 15),
    ('bife-chorizo', 'parrilla-sandwich-bife-chorizo-guarnicion', 'Sandwich de bife de chorizo completo con guarnicion', 'parrilla-sandwich-bife-chorizo-guarnicion', 23000, 16),
    ('bife-chorizo', 'parrilla-bife-chorizo-plato-guarnicion', 'Bife de chorizo al plato con guarnicion', 'parrilla-bife-chorizo-plato-guarnicion', 24000, 17)
),
upsert_prices as (
  insert into menu_content.menu_prices (pricing_key, kind, amount)
  select pricing_key, 'fixed', amount
  from grill_items
  on conflict (pricing_key) do nothing
)
insert into menu_content.menu_grill_catalog_items (
  family_id,
  item_id,
  name,
  description,
  note,
  image_path,
  available,
  pricing_key,
  order_index
)
select
  grill_items.family_id,
  grill_items.item_id,
  grill_items.name,
  null,
  null,
  null,
  true,
  grill_items.pricing_key,
  grill_items.order_index
from grill_items
on conflict (item_id) do update
set
  family_id = excluded.family_id,
  name = excluded.name,
  description = excluded.description,
  note = excluded.note,
  image_path = excluded.image_path,
  available = excluded.available,
  pricing_key = excluded.pricing_key,
  order_index = excluded.order_index;
