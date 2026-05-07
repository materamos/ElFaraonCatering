-- Idempotent hardening for the active flat menu_content model.
-- This file does not drop legacy tables. Legacy cleanup must be a later migration.

alter table menu_content.menu_prices
  drop constraint if exists menu_prices_kind_amount_valid;

alter table menu_content.menu_prices
  add constraint menu_prices_kind_amount_valid check (
    (kind = 'fixed' and amount is not null)
    or (kind in ('included', 'variants') and amount is null)
  );

alter table menu_content.menu_profile_facts
  drop constraint if exists menu_profile_facts_link_pair_valid;

alter table menu_content.menu_profile_facts
  add constraint menu_profile_facts_link_pair_valid check (
    (link_text is null and link_href is null)
    or (link_text is not null and link_href is not null)
  );

create unique index if not exists menu_price_variants_pricing_key_order_key
  on menu_content.menu_price_variants (pricing_key, order_index);

create unique index if not exists menu_daily_items_item_id_key
  on menu_content.menu_daily_items (item_id);

create unique index if not exists menu_daily_items_order_key
  on menu_content.menu_daily_items (order_index);

create unique index if not exists menu_profile_service_settings_profile_key
  on menu_content.menu_profile_service_settings (profile_id);

create unique index if not exists menu_catalog_sections_section_id_key
  on menu_content.menu_catalog_sections (section_id);

create unique index if not exists menu_catalog_sections_order_key
  on menu_content.menu_catalog_sections (order_index);

create unique index if not exists menu_catalog_groups_section_group_id_key
  on menu_content.menu_catalog_groups (section_id, group_id);

create unique index if not exists menu_catalog_groups_section_order_key
  on menu_content.menu_catalog_groups (section_id, order_index);

create unique index if not exists menu_catalog_items_context_item_id_key
  on menu_content.menu_catalog_items (section_id, group_id, item_id);

create unique index if not exists menu_catalog_items_context_order_key
  on menu_content.menu_catalog_items (section_id, group_id, order_index);

create unique index if not exists menu_catalog_item_options_item_order_key
  on menu_content.menu_catalog_item_options (catalog_item_id, order_index);

create unique index if not exists menu_grill_families_order_key
  on menu_content.menu_grill_families (order_index);

create unique index if not exists menu_grill_catalog_items_item_id_key
  on menu_content.menu_grill_catalog_items (item_id);

create unique index if not exists menu_grill_catalog_items_order_key
  on menu_content.menu_grill_catalog_items (order_index);

revoke all on schema menu_content from anon, authenticated;
revoke all on all tables in schema menu_content from anon, authenticated;
revoke all on all sequences in schema menu_content from anon, authenticated;
