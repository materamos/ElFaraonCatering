-- Drop redundant unique indexes and the vestigial (id, item_id) constraint on
-- menu_content.menu_catalog_items. These objects duplicated the indexes that
-- are already created automatically by the inline `unique (...)` clauses and
-- primary keys in schema.sql, so removing them does not change uniqueness
-- guarantees and reduces per-row write overhead.
--
-- Idempotent. Safe to re-run.

-- 1. Drop the redundant unique constraint on (id, item_id) from menu_catalog_items.
--    `id` is already the primary key, so (id, item_id) uniqueness is implied.
alter table menu_content.menu_catalog_items
  drop constraint if exists menu_catalog_items_id_item_id_key;

drop index if exists menu_content.menu_catalog_items_id_item_id_key;

-- 2. Drop redundant unique indexes that overlap with auto-generated indexes
--    backing the inline `unique (...)` clauses in schema.sql.
drop index if exists menu_content.menu_price_variants_pricing_key_order_key;
drop index if exists menu_content.menu_daily_items_order_key;
drop index if exists menu_content.menu_profile_service_settings_profile_key;
drop index if exists menu_content.menu_catalog_sections_order_key;
drop index if exists menu_content.menu_catalog_groups_section_group_id_key;
drop index if exists menu_content.menu_catalog_groups_section_order_key;
drop index if exists menu_content.menu_catalog_items_context_item_id_key;
drop index if exists menu_content.menu_catalog_items_context_order_key;
drop index if exists menu_content.menu_catalog_item_options_item_order_key;
drop index if exists menu_content.menu_grill_families_order_key;
drop index if exists menu_content.menu_grill_catalog_items_order_key;
