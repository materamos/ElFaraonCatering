-- Audit expected structural constraints and indexes for the active flat menu_content model.
-- This file is read-only: it does not mutate data or schema.

with expected_tables (table_name, expectation) as (
  values
    ('menu_profiles', 'profile metadata read at build time'),
    ('menu_profile_facts', 'profile fact rows read at build time'),
    ('menu_profile_payments', 'profile payment metadata read at build time'),
    ('menu_profile_payment_methods', 'profile payment methods read at build time'),
    ('menu_prices', 'global build-time prices'),
    ('menu_price_variants', 'global build-time variant prices'),
    ('menu_daily_items', 'three build-time daily menu options'),
    ('menu_profile_service_settings', 'active build-time service per profile'),
    ('menu_catalog_sections', 'flat build-time catalog sections'),
    ('menu_catalog_groups', 'flat build-time catalog groups'),
    ('menu_catalog_items', 'flat build-time catalog items'),
    ('menu_catalog_item_options', 'flat build-time catalog item options'),
    ('menu_grill_families', 'fixed build-time grill families'),
    ('menu_grill_catalog_items', 'fixed build-time grill item list')
),
actual_tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'menu_content'
    and table_type = 'BASE TABLE'
)
select
  'table' as object_type,
  expected.table_name as object_name,
  expected.table_name,
  case
    when actual.table_name is null then 'missing'
    else 'present'
  end as status,
  expected.expectation
from expected_tables expected
left join actual_tables actual
  on actual.table_name = expected.table_name
order by expected.table_name;

with expected_constraints (constraint_name, table_name, expectation) as (
  values
    ('menu_prices_kind_amount_valid', 'menu_prices', 'fixed requires amount; included/variants require null amount'),
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
    ('menu_daily_items_item_id_key', 'menu_daily_items', 'unique daily menu item id'),
    ('menu_daily_items_order_key', 'menu_daily_items', 'unique daily menu order'),
    ('menu_profile_service_settings_profile_key', 'menu_profile_service_settings', 'unique service settings row per profile'),
    ('menu_price_variants_pricing_key_order_key', 'menu_price_variants', 'unique variant order per price'),
    ('menu_catalog_sections_section_id_key', 'menu_catalog_sections', 'unique catalog section id'),
    ('menu_catalog_sections_order_key', 'menu_catalog_sections', 'unique catalog section order'),
    ('menu_catalog_groups_section_group_id_key', 'menu_catalog_groups', 'unique group id per section'),
    ('menu_catalog_groups_section_order_key', 'menu_catalog_groups', 'unique group order per section'),
    ('menu_catalog_items_context_item_id_key', 'menu_catalog_items', 'unique item id per section/group context'),
    ('menu_catalog_items_context_order_key', 'menu_catalog_items', 'unique item order per section/group context'),
    ('menu_catalog_item_options_item_order_key', 'menu_catalog_item_options', 'unique option order per catalog item'),
    ('menu_grill_families_order_key', 'menu_grill_families', 'unique grill family order'),
    ('menu_grill_catalog_items_item_id_key', 'menu_grill_catalog_items', 'unique grill item id'),
    ('menu_grill_catalog_items_order_key', 'menu_grill_catalog_items', 'unique grill item order')
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
  'menu_daily_items_count_invalid' as diagnostic,
  count(*) as daily_item_count
from menu_content.menu_daily_items
having count(*) <> 3;

select
  'menu_profile_service_settings_missing' as diagnostic,
  profile.id as profile_id
from menu_content.menu_profiles profile
left join menu_content.menu_profile_service_settings settings
  on settings.profile_id = profile.id
where settings.profile_id is null;

select
  'menu_catalog_item_group_missing' as diagnostic,
  item.section_id,
  item.group_id,
  item.item_id
from menu_content.menu_catalog_items item
left join menu_content.menu_catalog_groups menu_group
  on menu_group.section_id = item.section_id
 and menu_group.group_id = item.group_id
where item.group_id <> ''
  and menu_group.group_id is null;

select
  'legacy_table_still_present' as diagnostic,
  table_name
from information_schema.tables
where table_schema = 'menu_content'
  and table_name in (
    'menu_daily_menu',
    'menu_daily_service_settings',
    'menu_sections',
    'menu_groups',
    'menu_items',
    'menu_item_options',
    'menu_section_items',
    'menu_group_items',
    'menu_grill_items',
    'menu_overrides',
    'menu_override_sections',
    'menu_override_groups',
    'menu_override_section_items',
    'menu_override_group_items'
  )
order by table_name;
