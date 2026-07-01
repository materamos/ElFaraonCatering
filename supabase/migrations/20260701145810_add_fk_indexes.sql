create index if not exists menu_catalog_items_pricing_key_idx
  on menu_content.menu_catalog_items (pricing_key);

create index if not exists menu_daily_items_pricing_key_idx
  on menu_content.menu_daily_items (pricing_key);

create index if not exists menu_grill_catalog_items_pricing_key_idx
  on menu_content.menu_grill_catalog_items (pricing_key);

create index if not exists menu_price_variants_pricing_key_price_kind_idx
  on menu_content.menu_price_variants (pricing_key, price_kind);

create index if not exists menu_availability_overlays_updated_by_idx
  on public.menu_availability_overlays (updated_by);

create index if not exists staff_users_default_availability_profile_id_idx
  on public.staff_users (default_availability_profile_id);
