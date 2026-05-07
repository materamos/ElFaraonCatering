-- Broad read-only inventory and exposure audit for the project schemas.
-- This file does not mutate data or schema.

-- 01. Schema inventory.
select
  n.nspname as schema_name,
  'schema' as object_type,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname = 'menu_content' then 'Project build-time structural and operational source.'
    when n.nspname = 'public' then 'Runtime surface. Only availability overlay is expected for this project.'
    else 'Supabase-managed or unrelated schema.'
  end as reason
from pg_namespace n
where n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by n.nspname;

-- 02. Relation inventory in project-relevant schemas.
select
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    else c.relkind::text
  end as object_type,
  case
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' and c.relname in ('editor_profiles', 'menu_availability_overlays') then 'keep'
    else 'review'
  end as suggested_status,
  c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('menu_content', 'public')
  and c.relkind in ('r', 'p', 'v', 'm')
order by n.nspname, c.relname;

-- 03. Documented relation drift.
with documented_relations(schema_name, object_name, object_type, status) as (
  values
    ('menu_content', 'menu_profiles', 'table', 'active'),
    ('menu_content', 'menu_profile_facts', 'table', 'active'),
    ('menu_content', 'menu_profile_payments', 'table', 'active'),
    ('menu_content', 'menu_profile_payment_methods', 'table', 'active'),
    ('menu_content', 'menu_prices', 'table', 'active'),
    ('menu_content', 'menu_price_variants', 'table', 'active'),
    ('menu_content', 'menu_daily_items', 'table', 'active'),
    ('menu_content', 'menu_profile_service_settings', 'table', 'active'),
    ('menu_content', 'menu_catalog_sections', 'table', 'active'),
    ('menu_content', 'menu_catalog_groups', 'table', 'active'),
    ('menu_content', 'menu_catalog_items', 'table', 'active'),
    ('menu_content', 'menu_catalog_item_options', 'table', 'active'),
    ('menu_content', 'menu_grill_families', 'table', 'active'),
    ('menu_content', 'menu_grill_catalog_items', 'table', 'active'),
    ('menu_content', 'menu_daily_menu', 'table', 'legacy'),
    ('menu_content', 'menu_daily_service_settings', 'table', 'legacy'),
    ('menu_content', 'menu_sections', 'table', 'legacy'),
    ('menu_content', 'menu_groups', 'table', 'legacy'),
    ('menu_content', 'menu_items', 'table', 'legacy'),
    ('menu_content', 'menu_item_options', 'table', 'legacy'),
    ('menu_content', 'menu_section_items', 'table', 'legacy'),
    ('menu_content', 'menu_group_items', 'table', 'legacy'),
    ('menu_content', 'menu_grill_items', 'table', 'legacy'),
    ('menu_content', 'menu_overrides', 'table', 'legacy'),
    ('menu_content', 'menu_override_sections', 'table', 'legacy'),
    ('menu_content', 'menu_override_groups', 'table', 'legacy'),
    ('menu_content', 'menu_override_section_items', 'table', 'legacy'),
    ('menu_content', 'menu_override_group_items', 'table', 'legacy'),
    ('public', 'editor_profiles', 'table', 'active'),
    ('public', 'menu_availability_overlays', 'table', 'active')
),
observed_relations as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      else c.relkind::text
    end as object_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('menu_content', 'public')
    and c.relkind in ('r', 'p', 'v', 'm')
)
select
  o.schema_name,
  o.object_name,
  o.object_type,
  case
    when d.status = 'active' then 'keep'
    when d.status = 'legacy' then 'review'
    when d.object_name is null then 'unknown'
    else 'review'
  end as suggested_status,
  case
    when d.status = 'active' then 'Documented active project relation.'
    when d.status = 'legacy' then 'Legacy relation intentionally retained until a later cleanup migration.'
    else 'Relation is not documented by this project audit.'
  end as reason
from observed_relations o
left join documented_relations d
  on d.schema_name = o.schema_name
 and d.object_name = o.object_name
 and d.object_type = o.object_type
order by o.schema_name, o.object_name;

-- 04. Grants visible to client-facing roles.
select
  g.table_schema,
  g.table_name,
  g.grantee,
  g.privilege_type,
  case
    when g.table_schema = 'menu_content' and lower(g.grantee) in ('anon', 'authenticated', 'public') then 'risk'
    when g.table_schema = 'public' and g.table_name = 'menu_availability_overlays' and lower(g.grantee) in ('anon', 'authenticated') and g.privilege_type = 'SELECT' then 'keep'
    when lower(g.grantee) in ('anon', 'authenticated', 'public') then 'review'
    else 'review'
  end as suggested_status
from information_schema.table_privileges g
where g.table_schema in ('menu_content', 'public')
  and lower(g.grantee) in ('anon', 'authenticated', 'public')
order by g.table_schema, g.table_name, g.grantee, g.privilege_type;

-- 05. RLS status for public runtime tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case
    when n.nspname = 'public' and c.relname in ('editor_profiles', 'menu_availability_overlays') and c.relrowsecurity then 'keep'
    when n.nspname = 'public' then 'review'
    else 'keep'
  end as suggested_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('menu_content', 'public')
  and c.relkind = 'r'
order by n.nspname, c.relname;

-- 06. Policies in project-relevant schemas.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname in ('menu_content', 'public')
order by schemaname, tablename, policyname;

-- 07. Availability overlay targets that do not match active rendered targets.
with active_targets as (
  select profile.id as menu_id, 'menu-del-dia'::text as section_id, ''::text as group_id, item.item_id
  from menu_content.menu_profiles profile
  join menu_content.menu_profile_service_settings settings
    on settings.profile_id = profile.id
   and settings.service_kind = 'daily-menu'
  cross join menu_content.menu_daily_items item

  union all

  select profile.id, 'parrilla', '', item.item_id
  from menu_content.menu_profiles profile
  join menu_content.menu_profile_service_settings settings
    on settings.profile_id = profile.id
   and settings.service_kind = 'grill'
  cross join menu_content.menu_grill_catalog_items item

  union all

  select profile.id, item.section_id, item.group_id, item.item_id
  from menu_content.menu_profiles profile
  cross join menu_content.menu_catalog_items item
)
select
  overlay.menu_id,
  overlay.section_id,
  overlay.group_id,
  overlay.item_id,
  'risk' as suggested_status,
  'Availability overlay row does not match an active rendered menu target.' as reason
from public.menu_availability_overlays overlay
where not exists (
  select 1
  from active_targets target
  where target.menu_id = overlay.menu_id
    and target.section_id = overlay.section_id
    and target.group_id = coalesce(overlay.group_id, '')
    and target.item_id = overlay.item_id
)
order by overlay.menu_id, overlay.section_id, overlay.group_id, overlay.item_id;

-- 08. Image paths with invalid format in the active catalog.
select
  'menu_catalog_items' as object_name,
  section_id,
  group_id,
  item_id,
  image_path
from menu_content.menu_catalog_items
where image_path is not null
  and not (
    image_path like '/uploads/%'
    and image_path not like '//%'
    and image_path not like '%\%'
    and image_path not like '%?%'
    and image_path not like '%#%'
    and image_path !~ '(^|/)\.\.?(/|$)'
    and lower(image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
  )
union all
select
  'menu_grill_catalog_items',
  'parrilla',
  family_id,
  item_id,
  image_path
from menu_content.menu_grill_catalog_items
where image_path is not null
  and not (
    image_path like '/uploads/%'
    and image_path not like '//%'
    and image_path not like '%\%'
    and image_path not like '%?%'
    and image_path not like '%#%'
    and image_path !~ '(^|/)\.\.?(/|$)'
    and lower(image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
  );
