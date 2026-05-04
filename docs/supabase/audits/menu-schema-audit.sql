-- Audit expected structural constraints and indexes for menu_content.
-- This file is read-only: it does not mutate data or schema.

with expected_constraints (constraint_name, table_name, expectation) as (
  values
    ('menu_daily_menu_singleton_valid', 'menu_daily_menu', 'only the current daily menu row is allowed'),
    ('menu_prices_kind_amount_valid', 'menu_prices', 'fixed requires amount; included/variants require null amount'),
    ('menu_sections_scope_menu_id_valid', 'menu_sections', 'catalog requires null menu_id; daily requires non-null menu_id'),
    ('menu_profile_facts_link_pair_valid', 'menu_profile_facts', 'link_text and link_href must both be null or both be present')
),
actual_constraints as (
  select
    constraint_name,
    table_name
  from information_schema.table_constraints
  where table_schema = 'menu_content'
)
select
  'constraint' as object_type,
  expected.constraint_name as object_name,
  expected.table_name,
  case
    when actual.constraint_name is null then 'missing'
    else 'present'
  end as status,
  expected.expectation
from expected_constraints expected
left join actual_constraints actual
  on actual.constraint_name = expected.constraint_name
 and actual.table_name = expected.table_name
order by expected.table_name, expected.constraint_name;

with expected_indexes (index_name, table_name, expectation) as (
  values
    ('menu_daily_service_settings_profile_key', 'menu_daily_service_settings', 'unique settings row per profile'),
    ('menu_grill_items_item_id_key', 'menu_grill_items', 'unique grill item id'),
    ('menu_grill_items_order_index_key', 'menu_grill_items', 'unique grill item order'),
    ('menu_prices_pricing_key_kind_key', 'menu_prices', 'unique pricing_key + kind for variant FK'),
    ('menu_price_variants_pricing_key_order_key', 'menu_price_variants', 'unique variant order per price'),
    ('menu_sections_context_section_id_key', 'menu_sections', 'unique section_id per section scope and menu'),
    ('menu_sections_context_order_key', 'menu_sections', 'unique section order per section scope and menu'),
    ('menu_groups_section_group_id_key', 'menu_groups', 'unique group_id per section'),
    ('menu_groups_section_order_key', 'menu_groups', 'unique group order per section'),
    ('menu_items_id_item_id_key', 'menu_items', 'unique id + item_id for contextual item FK'),
    ('menu_section_items_section_item_id_key', 'menu_section_items', 'unique item_id per section'),
    ('menu_section_items_section_order_key', 'menu_section_items', 'unique item order per section'),
    ('menu_group_items_group_item_id_key', 'menu_group_items', 'unique item_id per group'),
    ('menu_group_items_group_order_key', 'menu_group_items', 'unique item order per group'),
    ('menu_item_options_item_order_key', 'menu_item_options', 'unique option order per item'),
    ('menu_overrides_menu_id_key', 'menu_overrides', 'unique override per menu'),
    ('menu_override_sections_override_section_id_key', 'menu_override_sections', 'unique override section per override'),
    ('menu_override_sections_override_order_key', 'menu_override_sections', 'unique override section order per override'),
    ('menu_override_groups_section_group_id_key', 'menu_override_groups', 'unique override group per override section'),
    ('menu_override_groups_section_order_key', 'menu_override_groups', 'unique override group order per override section'),
    ('menu_override_section_items_section_item_id_key', 'menu_override_section_items', 'unique override item per override section'),
    ('menu_override_section_items_section_order_key', 'menu_override_section_items', 'unique override item order per override section'),
    ('menu_override_group_items_group_item_id_key', 'menu_override_group_items', 'unique override item per override group'),
    ('menu_override_group_items_group_order_key', 'menu_override_group_items', 'unique override item order per override group')
),
actual_indexes as (
  select
    indexname as index_name,
    tablename as table_name
  from pg_indexes
  where schemaname = 'menu_content'
)
select
  'index' as object_type,
  expected.index_name as object_name,
  expected.table_name,
  case
    when actual.index_name is null then 'missing'
    else 'present'
  end as status,
  expected.expectation
from expected_indexes expected
left join actual_indexes actual
  on actual.index_name = expected.index_name
 and actual.table_name = expected.table_name
order by expected.table_name, expected.index_name;

-- Diagnostic rows that would block the hardening constraints.

select
  'menu_prices_kind_amount_invalid' as diagnostic,
  pricing_key,
  kind,
  amount
from menu_content.menu_prices
where not (
  (kind = 'fixed' and amount is not null)
  or (kind in ('included', 'variants') and amount is null)
);

select
  'menu_sections_scope_menu_id_invalid' as diagnostic,
  section_key,
  section_scope,
  menu_id,
  section_id
from menu_content.menu_sections
where not (
  (section_scope = 'catalog' and menu_id is null)
  or (section_scope = 'daily' and menu_id is not null)
);

select
  'menu_profile_facts_link_pair_invalid' as diagnostic,
  profile_id,
  fact_id,
  link_text,
  link_href
from menu_content.menu_profile_facts
where not (
  (link_text is null and link_href is null)
  or (link_text is not null and link_href is not null)
);

select
  'menu_daily_menu_singleton_invalid' as diagnostic,
  id
from menu_content.menu_daily_menu
where id <> 'current';

-- Duplicate diagnostics for unique indexes created by hardening.

with duplicate_checks as (
  select 'menu_daily_service_settings_profile_key' as index_name, profile_id::text as context_key, profile_id::text as duplicate_key, count(*) as duplicate_count
  from menu_content.menu_daily_service_settings
  group by profile_id
  having count(*) > 1

  union all

  select 'menu_grill_items_item_id_key', 'parrilla', item_id, count(*)
  from menu_content.menu_grill_items
  group by item_id
  having count(*) > 1

  union all

  select 'menu_grill_items_order_index_key', 'parrilla', order_index::text, count(*)
  from menu_content.menu_grill_items
  group by order_index
  having count(*) > 1

  union all

  select 'menu_price_variants_pricing_key_order_key' as index_name, pricing_key::text as context_key, order_index::text as duplicate_key, count(*) as duplicate_count
  from menu_content.menu_price_variants
  group by pricing_key, order_index
  having count(*) > 1

  union all

  select 'menu_sections_context_section_id_key', concat(section_scope, ':', coalesce(menu_id, '')), section_id, count(*)
  from menu_content.menu_sections
  group by section_scope, coalesce(menu_id, ''), section_id
  having count(*) > 1

  union all

  select 'menu_sections_context_order_key', concat(section_scope, ':', coalesce(menu_id, '')), order_index::text, count(*)
  from menu_content.menu_sections
  group by section_scope, coalesce(menu_id, ''), order_index
  having count(*) > 1

  union all

  select 'menu_groups_section_group_id_key', section_row_id::text, group_id, count(*)
  from menu_content.menu_groups
  group by section_row_id, group_id
  having count(*) > 1

  union all

  select 'menu_groups_section_order_key', section_row_id::text, order_index::text, count(*)
  from menu_content.menu_groups
  group by section_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_section_items_section_item_id_key', section_row_id::text, item_id, count(*)
  from menu_content.menu_section_items
  group by section_row_id, item_id
  having count(*) > 1

  union all

  select 'menu_section_items_section_order_key', section_row_id::text, order_index::text, count(*)
  from menu_content.menu_section_items
  group by section_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_group_items_group_item_id_key', group_row_id::text, item_id, count(*)
  from menu_content.menu_group_items
  group by group_row_id, item_id
  having count(*) > 1

  union all

  select 'menu_group_items_group_order_key', group_row_id::text, order_index::text, count(*)
  from menu_content.menu_group_items
  group by group_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_item_options_item_order_key', item_row_id::text, order_index::text, count(*)
  from menu_content.menu_item_options
  group by item_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_overrides_menu_id_key', menu_id, menu_id, count(*)
  from menu_content.menu_overrides
  group by menu_id
  having count(*) > 1

  union all

  select 'menu_override_sections_override_section_id_key', override_row_id::text, section_id, count(*)
  from menu_content.menu_override_sections
  group by override_row_id, section_id
  having count(*) > 1

  union all

  select 'menu_override_sections_override_order_key', override_row_id::text, order_index::text, count(*)
  from menu_content.menu_override_sections
  group by override_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_override_groups_section_group_id_key', override_section_row_id::text, group_id, count(*)
  from menu_content.menu_override_groups
  group by override_section_row_id, group_id
  having count(*) > 1

  union all

  select 'menu_override_groups_section_order_key', override_section_row_id::text, order_index::text, count(*)
  from menu_content.menu_override_groups
  group by override_section_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_override_section_items_section_item_id_key', override_section_row_id::text, item_id, count(*)
  from menu_content.menu_override_section_items
  group by override_section_row_id, item_id
  having count(*) > 1

  union all

  select 'menu_override_section_items_section_order_key', override_section_row_id::text, order_index::text, count(*)
  from menu_content.menu_override_section_items
  group by override_section_row_id, order_index
  having count(*) > 1

  union all

  select 'menu_override_group_items_group_item_id_key', override_group_row_id::text, item_id, count(*)
  from menu_content.menu_override_group_items
  group by override_group_row_id, item_id
  having count(*) > 1

  union all

  select 'menu_override_group_items_group_order_key', override_group_row_id::text, order_index::text, count(*)
  from menu_content.menu_override_group_items
  group by override_group_row_id, order_index
  having count(*) > 1
)
select *
from duplicate_checks
order by index_name, context_key, duplicate_key;
