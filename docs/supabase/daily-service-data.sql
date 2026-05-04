-- Idempotent data patch for the daily service model.
-- Run after docs/supabase/schema.sql.
-- This inserts operational defaults only if missing; update these rows directly for daily changes.

insert into menu_content.menu_prices (pricing_key, kind, amount)
values
  ('menu-del-dia', 'fixed', 7500),
  ('menu-del-dia-con-bebida', 'fixed', 9900),
  ('menu-vegetariano-del-dia', 'fixed', 7500)
on conflict (pricing_key) do nothing;

insert into menu_content.menu_daily_menu (
  id,
  name,
  description,
  note,
  available,
  pricing_key
)
values (
  'current',
  'Menu del dia',
  null,
  null,
  true,
  'menu-del-dia'
)
on conflict (id) do nothing;

with settings (profile_id, grill_enabled) as (
  values
    ('corpo', false),
    ('teleinde', false)
)
insert into menu_content.menu_daily_service_settings (
  profile_id,
  grill_enabled
)
select
  profile_id,
  grill_enabled
from settings
on conflict (profile_id) do nothing;

with grill_items (
  item_key,
  item_id,
  name,
  pricing_key,
  amount,
  order_index
) as (
  values
    ('parrilla-choripan', 'parrilla-choripan', 'Choripan', 'parrilla-choripan', 7000, 0),
    ('parrilla-choripan-guarnicion', 'parrilla-choripan-guarnicion', 'Choripan con guarnicion', 'parrilla-choripan-guarnicion', 9500, 1),
    ('parrilla-hamburguesa-completa', 'parrilla-hamburguesa-completa', 'Hamburguesa completa', 'parrilla-hamburguesa-completa', 10000, 2),
    ('parrilla-hamburguesa-completa-guarnicion', 'parrilla-hamburguesa-completa-guarnicion', 'Hamburguesa completa con guarnicion', 'parrilla-hamburguesa-completa-guarnicion', 13000, 3),
    ('parrilla-sandwich-bondiola-completo', 'parrilla-sandwich-bondiola-completo', 'Sandwich de bondiola completo', 'parrilla-sandwich-bondiola-completo', 13000, 4),
    ('parrilla-sandwich-bondiola-guarnicion', 'parrilla-sandwich-bondiola-guarnicion', 'Sandwich de bondiola con guarnicion', 'parrilla-sandwich-bondiola-guarnicion', 15000, 5),
    ('parrilla-bondiola-plato-guarnicion', 'parrilla-bondiola-plato-guarnicion', 'Bondiola al plato con guarnicion', 'parrilla-bondiola-plato-guarnicion', 16000, 6),
    ('parrilla-matambre-pizza-guarnicion', 'parrilla-matambre-pizza-guarnicion', 'Matambre a la pizza con guarnicion', 'parrilla-matambre-pizza-guarnicion', 17000, 7),
    ('parrilla-matambre-fugazzeta-guarnicion', 'parrilla-matambre-fugazzeta-guarnicion', 'Matambre a la fugazzeta con guarnicion', 'parrilla-matambre-fugazzeta-guarnicion', 17000, 8),
    ('parrilla-sandwich-entrana-completo', 'parrilla-sandwich-entrana-completo', 'Sandwich de entrana completo', 'parrilla-sandwich-entrana-completo', 19000, 9),
    ('parrilla-sandwich-entrana-guarnicion', 'parrilla-sandwich-entrana-guarnicion', 'Sandwich de entrana completa con guarnicion', 'parrilla-sandwich-entrana-guarnicion', 22000, 10),
    ('parrilla-entrana-plato-guarnicion', 'parrilla-entrana-plato-guarnicion', 'Entrana al plato con guarnicion', 'parrilla-entrana-plato-guarnicion', 23000, 11),
    ('parrilla-sandwich-lomo-completo', 'parrilla-sandwich-lomo-completo', 'Sandwich de lomo completo', 'parrilla-sandwich-lomo-completo', 20000, 12),
    ('parrilla-sandwich-lomo-guarnicion', 'parrilla-sandwich-lomo-guarnicion', 'Sandwich de lomo completo con guarnicion', 'parrilla-sandwich-lomo-guarnicion', 23000, 13),
    ('parrilla-lomo-plato-guarnicion', 'parrilla-lomo-plato-guarnicion', 'Lomo al plato con guarnicion', 'parrilla-lomo-plato-guarnicion', 24000, 14),
    ('parrilla-sandwich-bife-chorizo-completo', 'parrilla-sandwich-bife-chorizo-completo', 'Sandwich de bife de chorizo completo', 'parrilla-sandwich-bife-chorizo-completo', 19000, 15),
    ('parrilla-sandwich-bife-chorizo-guarnicion', 'parrilla-sandwich-bife-chorizo-guarnicion', 'Sandwich de bife de chorizo completo con guarnicion', 'parrilla-sandwich-bife-chorizo-guarnicion', 23000, 16),
    ('parrilla-bife-chorizo-plato-guarnicion', 'parrilla-bife-chorizo-plato-guarnicion', 'Bife de chorizo al plato con guarnicion', 'parrilla-bife-chorizo-plato-guarnicion', 24000, 17)
),
upsert_prices as (
  insert into menu_content.menu_prices (pricing_key, kind, amount)
  select pricing_key, 'fixed', amount
  from grill_items
  on conflict (pricing_key) do update
  set
    kind = excluded.kind,
    amount = excluded.amount
  returning pricing_key
),
upsert_items as (
  insert into menu_content.menu_items (
    item_key,
    item_id,
    name,
    description,
    image_path
  )
  select
    item_key,
    item_id,
    name,
    null,
    null
  from grill_items
  on conflict (item_key) do update
  set
    item_id = excluded.item_id,
    name = excluded.name,
    description = excluded.description,
    image_path = excluded.image_path
  returning id, item_key, item_id
)
insert into menu_content.menu_grill_items (
  grill_item_key,
  item_row_id,
  item_id,
  order_index,
  available,
  note,
  pricing_key
)
select
  grill_items.item_key,
  upsert_items.id,
  grill_items.item_id,
  grill_items.order_index,
  true,
  null,
  grill_items.pricing_key
from grill_items
join upsert_items
  on upsert_items.item_key = grill_items.item_key
join upsert_prices
  on upsert_prices.pricing_key = grill_items.pricing_key
on conflict (grill_item_key) do update
set
  item_row_id = excluded.item_row_id,
  item_id = excluded.item_id,
  order_index = excluded.order_index,
  available = excluded.available,
  note = excluded.note,
  pricing_key = excluded.pricing_key;
