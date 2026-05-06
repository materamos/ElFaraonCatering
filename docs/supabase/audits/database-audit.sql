-- Read-only Supabase database audit for El Faraon.
-- Run this file in the Supabase SQL editor or with a read-only connection.
-- The statements below only use SELECT queries and do not modify data, schema, grants, or policies.

-- 01. Schema inventory.
select
  n.nspname as schema_name,
  n.nspname as object_name,
  'schema' as object_type,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Supabase-managed infrastructure schema.'
    when n.nspname = 'menu_content' then 'Project structural build-time menu source.'
    when n.nspname = 'public' then 'Runtime surface. Review contained objects individually.'
    else 'Schema is not documented by this project audit.'
  end as reason,
  jsonb_build_object(
    'owner', pg_get_userbyid(n.nspowner),
    'anon_usage', has_schema_privilege('anon', n.oid, 'USAGE'),
    'authenticated_usage', has_schema_privilege('authenticated', n.oid, 'USAGE')
  )::text as evidence,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Do not remove or edit directly.'
    when n.nspname = 'menu_content' then 'Keep as build-time source of truth.'
    when n.nspname = 'public' then 'Inspect objects, grants, RLS, and policies before deciding anything.'
    else 'Identify owner and usage before any future action.'
  end as recommended_action
from pg_namespace n
where n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by schema_name;

-- 02. Relation inventory with estimated row counts.
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
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Supabase-managed relation.'
    when n.nspname = 'menu_content' then 'Menu structural relation used at build time.'
    when n.nspname = 'public' then 'Runtime/public schema relation. Ownership must be reviewed per object.'
    else 'Relation is outside the documented project schemas.'
  end as reason,
  jsonb_build_object(
    'estimated_rows', greatest(c.reltuples::bigint, 0),
    'total_size_bytes', pg_total_relation_size(c.oid),
    'rls_enabled', c.relrowsecurity
  )::text as evidence,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Treat as platform infrastructure.'
    when n.nspname = 'menu_content' then 'Validate with menu audit queries and npm run menu:validate.'
    when n.nspname = 'public' then 'Check documentation, grants, RLS, policies, and runtime references.'
    else 'Review before any future migration or cleanup plan.'
  end as recommended_action
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
  and c.relkind in ('r', 'p', 'v', 'm')
order by schema_name, object_type, object_name;

-- 03. Function inventory.
select
  n.nspname as schema_name,
  p.proname as object_name,
  'function' as object_type,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname in ('menu_content', 'public') then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Supabase-managed or extension function.'
    when n.nspname in ('menu_content', 'public') then 'Function exists in a project-relevant schema and should be matched against documentation.'
    else 'Function is outside documented project schemas.'
  end as reason,
  jsonb_build_object(
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'result_type', pg_get_function_result(p.oid),
    'owner', pg_get_userbyid(p.proowner)
  )::text as evidence,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Do not edit directly.'
    else 'Review source, grants, and callers before any future action.'
  end as recommended_action
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by schema_name, object_name;

-- 04. Trigger inventory.
select
  n.nspname as schema_name,
  c.relname || '.' || t.tgname as object_name,
  'trigger' as object_type,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname in ('menu_content', 'public') then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Supabase-managed or extension trigger.'
    else 'Trigger should be matched against documented project behavior.'
  end as reason,
  jsonb_build_object(
    'table_name', c.relname,
    'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)
  )::text as evidence,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Do not edit directly.'
    else 'Review trigger purpose and callers before any future action.'
  end as recommended_action
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by schema_name, object_name;

-- 05. Policy inventory.
select
  p.schemaname as schema_name,
  p.tablename || '.' || p.policyname as object_name,
  'policy' as object_type,
  case
    when p.schemaname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when p.schemaname in ('menu_content', 'public') then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when p.schemaname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Supabase-managed policy.'
    else 'Observed RLS policy in a project-relevant schema.'
  end as reason,
  jsonb_build_object(
    'table_name', p.tablename,
    'command', p.cmd,
    'roles', p.roles,
    'qual', p.qual,
    'with_check', p.with_check
  )::text as evidence,
  case
    when p.schemaname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'Do not edit directly.'
    else 'Review whether policy matches the intended runtime surface.'
  end as recommended_action
from pg_policies p
where p.schemaname not like 'pg_%'
  and p.schemaname <> 'information_schema'
order by schema_name, object_name;

-- 06. Exact row counts for documented project-owned tables only.
select
  row_counts.schema_name,
  row_counts.object_name,
  'table_count' as object_type,
  'keep' as suggested_status,
  row_counts.reason,
  jsonb_build_object('exact_rows', row_counts.exact_rows)::text as evidence,
  'Use exact count for project audit context only. Do not infer cleanup from count alone.' as recommended_action
from (
  select 'menu_content'::text as schema_name, 'menu_profiles'::text as object_name, 'Menu structural table.'::text as reason, count(*)::bigint as exact_rows from menu_content.menu_profiles
  union all select 'menu_content', 'menu_profile_facts', 'Menu structural table.', count(*)::bigint from menu_content.menu_profile_facts
  union all select 'menu_content', 'menu_profile_payments', 'Menu structural table.', count(*)::bigint from menu_content.menu_profile_payments
  union all select 'menu_content', 'menu_profile_payment_methods', 'Menu structural table.', count(*)::bigint from menu_content.menu_profile_payment_methods
  union all select 'menu_content', 'menu_prices', 'Menu structural table.', count(*)::bigint from menu_content.menu_prices
  union all select 'menu_content', 'menu_price_variants', 'Menu structural table.', count(*)::bigint from menu_content.menu_price_variants
  union all select 'menu_content', 'menu_daily_menu', 'Menu structural table.', count(*)::bigint from menu_content.menu_daily_menu
  union all select 'menu_content', 'menu_daily_service_settings', 'Menu structural table.', count(*)::bigint from menu_content.menu_daily_service_settings
  union all select 'menu_content', 'menu_sections', 'Menu structural table.', count(*)::bigint from menu_content.menu_sections
  union all select 'menu_content', 'menu_groups', 'Menu structural table.', count(*)::bigint from menu_content.menu_groups
  union all select 'menu_content', 'menu_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_items
  union all select 'menu_content', 'menu_grill_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_grill_items
  union all select 'menu_content', 'menu_section_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_section_items
  union all select 'menu_content', 'menu_group_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_group_items
  union all select 'menu_content', 'menu_item_options', 'Menu structural table.', count(*)::bigint from menu_content.menu_item_options
  union all select 'menu_content', 'menu_overrides', 'Menu structural table.', count(*)::bigint from menu_content.menu_overrides
  union all select 'menu_content', 'menu_override_sections', 'Menu structural table.', count(*)::bigint from menu_content.menu_override_sections
  union all select 'menu_content', 'menu_override_groups', 'Menu structural table.', count(*)::bigint from menu_content.menu_override_groups
  union all select 'menu_content', 'menu_override_section_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_override_section_items
  union all select 'menu_content', 'menu_override_group_items', 'Menu structural table.', count(*)::bigint from menu_content.menu_override_group_items
  union all select 'public', 'editor_profiles', 'Documented runtime overlay table.', count(*)::bigint from public.editor_profiles
  union all select 'public', 'menu_availability_overlays', 'Documented runtime overlay table.', count(*)::bigint from public.menu_availability_overlays
) row_counts
order by schema_name, object_name;

-- 07. Observed grants for public-facing roles.
select
  g.table_schema as schema_name,
  g.table_name as object_name,
  'grant' as object_type,
  case
    when g.table_schema = 'menu_content' and lower(g.grantee) in ('anon', 'authenticated', 'public') then 'risk'
    when lower(g.grantee) in ('anon', 'public') and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') then 'risk'
    when g.table_schema = 'public' and g.table_name = 'menu_availability_overlays' and lower(g.grantee) = 'anon' and g.privilege_type = 'SELECT' then 'keep'
    else 'review'
  end as suggested_status,
  case
    when g.table_schema = 'menu_content' and lower(g.grantee) in ('anon', 'authenticated', 'public') then 'Structural build-time schema has an observed grant to a client-facing role.'
    when lower(g.grantee) in ('anon', 'public') and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') then 'Anonymous or PUBLIC write-like privilege observed.'
    when g.table_schema = 'public' and g.table_name = 'menu_availability_overlays' and lower(g.grantee) = 'anon' and g.privilege_type = 'SELECT' then 'Documented runtime overlay can be publicly readable.'
    else 'Observed grant. This audit reports it without defining expected grants.'
  end as reason,
  jsonb_build_object(
    'grantee', g.grantee,
    'privilege_type', g.privilege_type,
    'grantor', g.grantor,
    'is_grantable', g.is_grantable
  )::text as evidence,
  case
    when g.table_schema = 'menu_content' and lower(g.grantee) in ('anon', 'authenticated', 'public') then 'Review exposure and revoke in a separate approved migration if unintended.'
    when lower(g.grantee) in ('anon', 'public') and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') then 'Review immediately. Any change must be a separate approved migration.'
    else 'Compare with runtime needs and RLS policies before deciding.'
  end as recommended_action
from information_schema.table_privileges g
where g.table_schema not in ('pg_catalog', 'information_schema')
  and lower(g.grantee) in ('anon', 'authenticated', 'public')
order by schema_name, object_name, g.grantee, g.privilege_type;

-- 08. Public/runtime exposure and RLS posture.
select
  n.nspname as schema_name,
  c.relname as object_name,
  'exposure' as object_type,
  case
    when n.nspname = 'menu_content'
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('authenticated', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE')
      ) then 'risk'
    when n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity then 'risk'
    when n.nspname = 'public' then 'review'
    else 'keep'
  end as suggested_status,
  case
    when n.nspname = 'menu_content'
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('authenticated', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE')
      ) then 'Build-time structural table appears reachable by client-facing roles.'
    when n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity then 'Runtime table has RLS disabled.'
    when n.nspname = 'public' then 'Runtime/public surface. Review grants and policies.'
    else 'No client-facing exposure risk detected by this query.'
  end as reason,
  jsonb_build_object(
    'rls_enabled', c.relrowsecurity,
    'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
    'anon_insert', has_table_privilege('anon', c.oid, 'INSERT'),
    'anon_update', has_table_privilege('anon', c.oid, 'UPDATE'),
    'anon_delete', has_table_privilege('anon', c.oid, 'DELETE'),
    'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
    'authenticated_insert', has_table_privilege('authenticated', c.oid, 'INSERT'),
    'authenticated_update', has_table_privilege('authenticated', c.oid, 'UPDATE'),
    'authenticated_delete', has_table_privilege('authenticated', c.oid, 'DELETE')
  )::text as evidence,
  case
    when n.nspname = 'menu_content' then 'Keep structural data private. Any grant change belongs in a separate approved migration.'
    when n.nspname = 'public' then 'Confirm runtime need, RLS, and policies before any future change.'
    else 'No action from this audit.'
  end as recommended_action
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('menu_content', 'public')
  and c.relkind in ('r', 'p')
order by schema_name, object_name;

-- 09. Unexpected tables or views in project-relevant schemas.
with documented_relations(schema_name, object_name, object_type) as (
  values
    ('menu_content', 'menu_profiles', 'table'),
    ('menu_content', 'menu_profile_facts', 'table'),
    ('menu_content', 'menu_profile_payments', 'table'),
    ('menu_content', 'menu_profile_payment_methods', 'table'),
    ('menu_content', 'menu_prices', 'table'),
    ('menu_content', 'menu_price_variants', 'table'),
    ('menu_content', 'menu_daily_menu', 'table'),
    ('menu_content', 'menu_daily_service_settings', 'table'),
    ('menu_content', 'menu_sections', 'table'),
    ('menu_content', 'menu_groups', 'table'),
    ('menu_content', 'menu_items', 'table'),
    ('menu_content', 'menu_grill_items', 'table'),
    ('menu_content', 'menu_section_items', 'table'),
    ('menu_content', 'menu_group_items', 'table'),
    ('menu_content', 'menu_item_options', 'table'),
    ('menu_content', 'menu_overrides', 'table'),
    ('menu_content', 'menu_override_sections', 'table'),
    ('menu_content', 'menu_override_groups', 'table'),
    ('menu_content', 'menu_override_section_items', 'table'),
    ('menu_content', 'menu_override_group_items', 'table'),
    ('public', 'editor_profiles', 'table'),
    ('public', 'menu_availability_overlays', 'table')
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
    end as object_type,
    c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('menu_content', 'public')
    and c.relkind in ('r', 'p', 'v', 'm')
)
select
  o.schema_name,
  o.object_name,
  o.object_type,
  case when o.schema_name = 'menu_content' then 'review' else 'unknown' end as suggested_status,
  'Relation is present in a project-relevant schema but is not documented in the current Supabase SQL files.' as reason,
  jsonb_build_object(
    'estimated_rows', greatest(c.reltuples::bigint, 0),
    'total_size_bytes', pg_total_relation_size(o.oid)
  )::text as evidence,
  'Identify owner, runtime usage, and migration history before any future action.' as recommended_action
from observed_relations o
join pg_class c on c.oid = o.oid
where not exists (
  select 1
  from documented_relations d
  where d.schema_name = o.schema_name
    and d.object_name = o.object_name
    and d.object_type = o.object_type
)
order by o.schema_name, o.object_type, o.object_name;

-- 10. Unexpected functions in project-relevant schemas.
select
  n.nspname as schema_name,
  p.proname as object_name,
  'function' as object_type,
  case when n.nspname = 'menu_content' then 'review' else 'unknown' end as suggested_status,
  'Function is present in a project-relevant schema but is not documented in the current Supabase SQL files.' as reason,
  jsonb_build_object(
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'result_type', pg_get_function_result(p.oid),
    'owner', pg_get_userbyid(p.proowner)
  )::text as evidence,
  'Identify caller and purpose before any future action.' as recommended_action
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('menu_content', 'public')
order by schema_name, object_name;

-- 11. Unexpected triggers in project-relevant schemas.
select
  n.nspname as schema_name,
  c.relname || '.' || t.tgname as object_name,
  'trigger' as object_type,
  case when n.nspname = 'menu_content' then 'review' else 'unknown' end as suggested_status,
  'Trigger is present in a project-relevant schema but is not documented in the current Supabase SQL files.' as reason,
  jsonb_build_object(
    'table_name', c.relname,
    'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)
  )::text as evidence,
  'Identify trigger behavior before any future action.' as recommended_action
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('menu_content', 'public')
  and not t.tgisinternal
order by schema_name, object_name;

-- 12. Unexpected policies in project-relevant schemas.
with documented_policies(schema_name, table_name, policy_name) as (
  values
    ('public', 'editor_profiles', 'Editor profiles are readable by their users'),
    ('public', 'menu_availability_overlays', 'Menu availability overlays are publicly readable'),
    ('public', 'menu_availability_overlays', 'Editors can insert menu availability overlays'),
    ('public', 'menu_availability_overlays', 'Editors can update menu availability overlays'),
    ('public', 'menu_availability_overlays', 'Editors can delete menu availability overlays')
)
select
  p.schemaname as schema_name,
  p.tablename || '.' || p.policyname as object_name,
  'policy' as object_type,
  case when p.schemaname = 'menu_content' then 'review' else 'unknown' end as suggested_status,
  'Policy is present in a project-relevant schema but is not documented in the current Supabase SQL files.' as reason,
  jsonb_build_object(
    'table_name', p.tablename,
    'command', p.cmd,
    'roles', p.roles,
    'qual', p.qual,
    'with_check', p.with_check
  )::text as evidence,
  'Review policy against the intended runtime surface before any future action.' as recommended_action
from pg_policies p
where p.schemaname in ('menu_content', 'public')
  and not exists (
    select 1
    from documented_policies d
    where d.schema_name = p.schemaname
      and d.table_name = p.tablename
      and d.policy_name = p.policyname
  )
order by schema_name, object_name;

-- 13. Menu items that are not referenced by displayed menu relations.
with used_items as (
  select item_row_id from menu_content.menu_section_items
  union
  select item_row_id from menu_content.menu_group_items
  union
  select item_row_id from menu_content.menu_grill_items
)
select
  'menu_content' as schema_name,
  'menu_items' as object_name,
  'data' as object_type,
  'review' as suggested_status,
  'Menu item is not referenced by section, group, or grill display relations.' as reason,
  jsonb_build_object(
    'id', i.id,
    'item_key', i.item_key,
    'item_id', i.item_id,
    'name', i.name
  )::text as evidence,
  'Confirm whether this is staged content or obsolete data before any future cleanup plan.' as recommended_action
from menu_content.menu_items i
where not exists (
  select 1
  from used_items u
  where u.item_row_id = i.id
)
order by i.id;

-- 14. Prices not referenced by direct database relationships.
with direct_price_references as (
  select pricing_key from menu_content.menu_daily_menu where pricing_key is not null
  union all select pricing_key from menu_content.menu_grill_items where pricing_key is not null
  union all select pricing_key from menu_content.menu_groups where pricing_key is not null
  union all select pricing_key from menu_content.menu_section_items where pricing_key is not null
  union all select pricing_key from menu_content.menu_group_items where pricing_key is not null
),
semantic_price_keys(pricing_key) as (
  values
    ('menu-del-dia-con-bebida'),
    ('menu-vegetariano-del-dia')
)
select
  'menu_content' as schema_name,
  'menu_prices' as object_name,
  'data' as object_type,
  'review' as suggested_status,
  case
    when s.pricing_key is not null then 'Pricing key is not referenced by direct database relationships, but it is used by build-time semantic logic.'
    else 'Pricing key is not referenced by direct database relationships.'
  end as reason,
  jsonb_build_object(
    'pricing_key', p.pricing_key,
    'kind', p.kind,
    'amount', p.amount,
    'semantic_key', s.pricing_key is not null
  )::text as evidence,
  case
    when s.pricing_key is not null then 'Keep unless the build-time semantic key is intentionally removed from code.'
    else 'Review code and content history before any future cleanup plan.'
  end as recommended_action
from menu_content.menu_prices p
left join semantic_price_keys s on s.pricing_key = p.pricing_key
where not exists (
  select 1
  from direct_price_references r
  where r.pricing_key = p.pricing_key
)
order by p.pricing_key;

-- 15. Override containers with no override sections.
select
  'menu_content' as schema_name,
  'menu_overrides' as object_name,
  'data' as object_type,
  'review' as suggested_status,
  'Override container has no override sections.' as reason,
  jsonb_build_object(
    'override_id', o.id,
    'override_key', o.override_key,
    'menu_id', o.menu_id
  )::text as evidence,
  'Keep if used as intentional placeholder. Otherwise prepare cleanup only in a separate approved SQL file.' as recommended_action
from menu_content.menu_overrides o
where not exists (
  select 1
  from menu_content.menu_override_sections s
  where s.override_row_id = o.id
)
order by o.menu_id;

-- 16. Override sections that do not target documented catalog sections.
select
  'menu_content' as schema_name,
  'menu_override_sections' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Override section targets a section_id that is not present in the catalog sections.' as reason,
  jsonb_build_object(
    'override_section_id', os.id,
    'override_section_key', os.override_section_key,
    'section_id', os.section_id,
    'menu_id', o.menu_id
  )::text as evidence,
  'Review data source. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_override_sections os
join menu_content.menu_overrides o on o.id = os.override_row_id
where not exists (
  select 1
  from menu_content.menu_sections s
  where s.section_scope = 'catalog'
    and s.section_id = os.section_id
)
order by o.menu_id, os.section_id;

-- 17. Override groups that do not target groups in their section.
select
  'menu_content' as schema_name,
  'menu_override_groups' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Override group targets a group_id that is not present in the referenced catalog section.' as reason,
  jsonb_build_object(
    'override_group_id', og.id,
    'override_group_key', og.override_group_key,
    'menu_id', o.menu_id,
    'section_id', os.section_id,
    'group_id', og.group_id
  )::text as evidence,
  'Review data source. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_override_groups og
join menu_content.menu_override_sections os on os.id = og.override_section_row_id
join menu_content.menu_overrides o on o.id = os.override_row_id
where not exists (
  select 1
  from menu_content.menu_sections s
  join menu_content.menu_groups g on g.section_row_id = s.id
  where s.section_scope = 'catalog'
    and s.section_id = os.section_id
    and g.group_id = og.group_id
)
order by o.menu_id, os.section_id, og.group_id;

-- 18. Direct item overrides that do not target items in their section.
select
  'menu_content' as schema_name,
  'menu_override_section_items' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Direct item override targets an item_id that is not present in the referenced catalog section.' as reason,
  jsonb_build_object(
    'override_item_id', oi.id,
    'override_section_item_key', oi.override_section_item_key,
    'menu_id', o.menu_id,
    'section_id', os.section_id,
    'item_id', oi.item_id
  )::text as evidence,
  'Review data source. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_override_section_items oi
join menu_content.menu_override_sections os on os.id = oi.override_section_row_id
join menu_content.menu_overrides o on o.id = os.override_row_id
where not exists (
  select 1
  from menu_content.menu_sections s
  join menu_content.menu_section_items si on si.section_row_id = s.id
  where s.section_scope = 'catalog'
    and s.section_id = os.section_id
    and si.item_id = oi.item_id
)
order by o.menu_id, os.section_id, oi.item_id;

-- 19. Group item overrides that do not target items in their group.
select
  'menu_content' as schema_name,
  'menu_override_group_items' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Group item override targets an item_id that is not present in the referenced catalog group.' as reason,
  jsonb_build_object(
    'override_group_item_id', oi.id,
    'override_group_item_key', oi.override_group_item_key,
    'menu_id', o.menu_id,
    'section_id', os.section_id,
    'group_id', og.group_id,
    'item_id', oi.item_id
  )::text as evidence,
  'Review data source. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_override_group_items oi
join menu_content.menu_override_groups og on og.id = oi.override_group_row_id
join menu_content.menu_override_sections os on os.id = og.override_section_row_id
join menu_content.menu_overrides o on o.id = os.override_row_id
where not exists (
  select 1
  from menu_content.menu_sections s
  join menu_content.menu_groups g on g.section_row_id = s.id
  join menu_content.menu_group_items gi on gi.group_row_id = g.id
  where s.section_scope = 'catalog'
    and s.section_id = os.section_id
    and g.group_id = og.group_id
    and gi.item_id = oi.item_id
)
order by o.menu_id, os.section_id, og.group_id, oi.item_id;

-- 20. Availability overlays that target missing profiles.
select
  'public' as schema_name,
  'menu_availability_overlays' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Runtime availability overlay targets a menu_id that does not exist in menu profiles.' as reason,
  jsonb_build_object(
    'id', o.id,
    'menu_id', o.menu_id,
    'section_id', o.section_id,
    'group_id', o.group_id,
    'item_id', o.item_id
  )::text as evidence,
  'Review overlay source. Any cleanup must be a separate approved data migration.' as recommended_action
from public.menu_availability_overlays o
where not exists (
  select 1
  from menu_content.menu_profiles p
  where p.id = o.menu_id
)
order by o.menu_id, o.section_id, o.item_id;

-- 21. Availability overlays that target missing visible menu items.
select
  'public' as schema_name,
  'menu_availability_overlays' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Runtime availability overlay does not match a direct item or grouped item in catalog sections.' as reason,
  jsonb_build_object(
    'id', o.id,
    'menu_id', o.menu_id,
    'section_id', o.section_id,
    'group_id', o.group_id,
    'item_id', o.item_id
  )::text as evidence,
  'Review whether this overlay is stale. Any cleanup must be a separate approved data migration.' as recommended_action
from public.menu_availability_overlays o
where not exists (
  select 1
  from menu_content.menu_sections s
  join menu_content.menu_section_items si on si.section_row_id = s.id
  where s.section_scope = 'catalog'
    and s.section_id = o.section_id
    and o.group_id is null
    and si.item_id = o.item_id
)
and not exists (
  select 1
  from menu_content.menu_sections s
  join menu_content.menu_groups g on g.section_row_id = s.id
  join menu_content.menu_group_items gi on gi.group_row_id = g.id
  where s.section_scope = 'catalog'
    and s.section_id = o.section_id
    and o.group_id = g.group_id
    and gi.item_id = o.item_id
)
order by o.menu_id, o.section_id, o.group_id, o.item_id;

-- 22. Image paths with invalid format.
select
  'menu_content' as schema_name,
  'menu_items' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Image path is not a permitted local path under /uploads/. This query validates format only, not physical file existence.' as reason,
  jsonb_build_object(
    'id', i.id,
    'item_key', i.item_key,
    'item_id', i.item_id,
    'name', i.name,
    'image_path', i.image_path
  )::text as evidence,
  'Fix the content path in a separate approved data migration, or compare against a repo file inventory before judging file existence.' as recommended_action
from menu_content.menu_items i
where i.image_path is not null
  and not (
    i.image_path like '/uploads/%'
    and i.image_path not like '//%'
    and position(chr(92) in i.image_path) = 0
    and position('?' in i.image_path) = 0
    and position('#' in i.image_path) = 0
    and array_position(regexp_split_to_array(substring(i.image_path from length('/uploads/') + 1), '/'), '') is null
    and array_position(regexp_split_to_array(substring(i.image_path from length('/uploads/') + 1), '/'), '.') is null
    and array_position(regexp_split_to_array(substring(i.image_path from length('/uploads/') + 1), '/'), '..') is null
    and lower(i.image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
  )
order by i.id;

-- 23. Sections without display content.
select
  'menu_content' as schema_name,
  'menu_sections' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Section declares a content kind but has no matching display rows.' as reason,
  jsonb_build_object(
    'section_row_id', s.id,
    'section_key', s.section_key,
    'section_scope', s.section_scope,
    'menu_id', s.menu_id,
    'section_id', s.section_id,
    'content_kind', s.content_kind
  )::text as evidence,
  'Review menu structure. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_sections s
where (
    s.content_kind = 'items'
    and not exists (
      select 1
      from menu_content.menu_section_items si
      where si.section_row_id = s.id
    )
  )
  or (
    s.content_kind = 'groups'
    and not exists (
      select 1
      from menu_content.menu_groups g
      where g.section_row_id = s.id
    )
  )
order by s.section_scope, s.menu_id, s.order_index;

-- 24. Groups without display items.
select
  'menu_content' as schema_name,
  'menu_groups' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Group has no menu_group_items rows.' as reason,
  jsonb_build_object(
    'group_row_id', g.id,
    'group_key', g.group_key,
    'section_row_id', g.section_row_id,
    'group_id', g.group_id,
    'title', g.title
  )::text as evidence,
  'Review menu structure. Any fix must be a separate approved data migration.' as recommended_action
from menu_content.menu_groups g
where not exists (
  select 1
  from menu_content.menu_group_items gi
  where gi.group_row_id = g.id
)
order by g.section_row_id, g.order_index;

-- 25. Items that cannot resolve pricing through direct or group pricing.
select
  'menu_content' as schema_name,
  'menu_group_items' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Grouped item has no direct pricing and its group has no shared pricing.' as reason,
  jsonb_build_object(
    'group_item_id', gi.id,
    'group_item_key', gi.group_item_key,
    'group_id', g.group_id,
    'item_id', gi.item_id
  )::text as evidence,
  'Add direct item pricing or group shared pricing in a separate approved data migration.' as recommended_action
from menu_content.menu_group_items gi
join menu_content.menu_groups g on g.id = gi.group_row_id
where gi.pricing_key is null
  and g.pricing_key is null
union all
select
  'menu_content' as schema_name,
  'menu_section_items' as object_name,
  'data' as object_type,
  'risk' as suggested_status,
  'Direct section item has no pricing.' as reason,
  jsonb_build_object(
    'section_item_id', si.id,
    'section_item_key', si.section_item_key,
    'section_row_id', si.section_row_id,
    'item_id', si.item_id
  )::text as evidence,
  'Add direct item pricing in a separate approved data migration.' as recommended_action
from menu_content.menu_section_items si
where si.pricing_key is null
order by object_name, evidence;
