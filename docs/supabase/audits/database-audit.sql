-- Broad read-only inventory and exposure audit for the project schemas.
-- This file does not mutate data or schema.

-- 01. Schema inventory.
select
  n.nspname as schema_name,
  'schema' as object_type,
  case
    when n.nspname in ('auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public', 'pgbouncer') then 'do_not_touch'
    when n.nspname = 'app_private' then 'keep'
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' then 'review'
    else 'unknown'
  end as suggested_status,
  case
    when n.nspname = 'app_private' then 'Private operational CMS support objects.'
    when n.nspname = 'menu_content' then 'Project build-time structural and operational source.'
    when n.nspname = 'public' then 'Runtime availability overlay and operational CMS staff permissions.'
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
    when n.nspname = 'app_private' and c.relname in ('menu_publish_requests') then 'keep'
    when n.nspname = 'menu_content' then 'keep'
    when n.nspname = 'public' and c.relname in ('staff_users', 'menu_availability_overlays') then 'keep'
    else 'review'
  end as suggested_status,
  c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('app_private', 'menu_content', 'public')
  and c.relkind in ('r', 'p', 'v', 'm')
order by n.nspname, c.relname;

-- 03. Documented relation drift.
with documented_relations(schema_name, object_name, object_type, status) as (
  values
    ('app_private', 'menu_publish_requests', 'table', 'active'),
    ('menu_content', 'menu_profiles', 'table', 'active'),
    ('menu_content', 'menu_profile_facts', 'table', 'active'),
    ('menu_content', 'menu_prices', 'table', 'active'),
    ('menu_content', 'menu_price_variants', 'table', 'active'),
    ('menu_content', 'menu_daily_items', 'table', 'active'),
    ('menu_content', 'menu_profile_service_settings', 'table', 'active'),
    ('menu_content', 'menu_catalog_sections', 'table', 'active'),
    ('menu_content', 'menu_catalog_items', 'table', 'active'),
    ('menu_content', 'menu_catalog_item_images', 'table', 'active'),
    ('menu_content', 'menu_catalog_item_options', 'table', 'active'),
    ('menu_content', 'menu_grill_families', 'table', 'active'),
    ('menu_content', 'menu_grill_catalog_items', 'table', 'active'),
    ('public', 'staff_users', 'table', 'active'),
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
  where n.nspname in ('app_private', 'menu_content', 'public')
    and c.relkind in ('r', 'p', 'v', 'm')
)
select
  o.schema_name,
  o.object_name,
  o.object_type,
  case
    when d.status = 'active' then 'keep'
    when d.object_name is null then 'unknown'
    else 'review'
  end as suggested_status,
  case
    when d.status = 'active' then 'Documented active project relation.'
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
    when g.table_schema in ('app_private', 'menu_content') and lower(g.grantee) in ('anon', 'authenticated', 'public') then 'risk'
    when g.table_schema = 'public' and g.table_name = 'menu_availability_overlays' and lower(g.grantee) in ('anon', 'authenticated') and g.privilege_type = 'SELECT' then 'risk'
    when g.table_schema = 'public' and g.table_name = 'menu_availability_overlays' and lower(g.grantee) = 'authenticated' and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE') then 'risk'
    when g.table_schema = 'public' and g.table_name = 'staff_users' and lower(g.grantee) = 'authenticated' and g.privilege_type in ('SELECT', 'INSERT', 'UPDATE') then 'keep'
    when g.table_schema = 'public' and g.table_name = 'staff_users' and lower(g.grantee) in ('anon', 'public') then 'risk'
    when lower(g.grantee) in ('anon', 'authenticated', 'public') then 'review'
    else 'review'
  end as suggested_status
from information_schema.table_privileges g
where g.table_schema in ('app_private', 'menu_content', 'public')
  and lower(g.grantee) in ('anon', 'authenticated', 'public')
order by g.table_schema, g.table_name, g.grantee, g.privilege_type;

-- 05. Public overlay column grants.
with expected_overlay_select_columns(column_name) as (
  values
    ('menu_id'),
    ('section_id'),
    ('item_id'),
    ('available_override')
),
client_roles(grantee) as (
  values
    ('anon'),
    ('authenticated')
),
actual_column_grants as (
  select
    lower(grantee) as grantee,
    column_name
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'menu_availability_overlays'
    and privilege_type = 'SELECT'
    and lower(grantee) in ('anon', 'authenticated')
)
select
  role.grantee,
  expected.column_name,
  case
    when actual.column_name is null then 'missing'
    else 'present'
  end as status,
  case
    when actual.column_name is null then 'risk'
    else 'keep'
  end as suggested_status
from client_roles role
cross join expected_overlay_select_columns expected
left join actual_column_grants actual
  on actual.grantee = role.grantee
 and actual.column_name = expected.column_name
order by role.grantee, expected.column_name;

select
  lower(grantee) as grantee,
  column_name,
  'risk' as suggested_status,
  'Unexpected public overlay column SELECT grant.' as reason
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'menu_availability_overlays'
  and privilege_type = 'SELECT'
  and lower(grantee) in ('anon', 'authenticated')
  and column_name not in (
    'menu_id',
    'section_id',
    'item_id',
    'available_override'
  )
order by grantee, column_name;

-- 06. RLS status for public project tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case
    when n.nspname = 'app_private' and c.relname = 'menu_publish_requests' and c.relrowsecurity then 'keep'
    when n.nspname = 'public' and c.relname in ('staff_users', 'menu_availability_overlays') and c.relrowsecurity then 'keep'
    when n.nspname = 'public' then 'review'
    else 'keep'
  end as suggested_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('app_private', 'menu_content', 'public')
  and c.relkind = 'r'
order by n.nspname, c.relname;

-- 07. Policies in project-relevant schemas.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname in ('app_private', 'menu_content', 'public')
order by schemaname, tablename, policyname;

-- 07b. Required public policies after the prelaunch baseline.
with expected_policies (table_name, policy_name, command) as (
  values
    ('staff_users', 'Staff users can read permitted rows', 'SELECT'),
    ('staff_users', 'Admins can insert staff users', 'INSERT'),
    ('staff_users', 'Admins can update staff users', 'UPDATE'),
    ('menu_availability_overlays', 'Menu availability overlays are publicly readable', 'SELECT')
),
actual_policies as (
  select
    tablename as table_name,
    policyname as policy_name,
    cmd as command
  from pg_policies
  where schemaname = 'public'
)
select
  expected.table_name,
  expected.policy_name,
  expected.command,
  case
    when actual.policy_name is null then 'missing'
    else 'present'
  end as status
from expected_policies expected
left join actual_policies actual
  on actual.table_name = expected.table_name
 and actual.policy_name = expected.policy_name
 and actual.command = expected.command
order by expected.table_name, expected.policy_name;

-- 08. Staff permission and operational edit functions.
with expected_functions (function_name, identity_arguments, expectation) as (
  values
    ('is_active_staff', '', 'active staff membership check'),
    ('can_edit_availability', 'target_profile_id text', 'operator availability edit check'),
    ('can_edit_menu_content', '', 'build-time menu edit role check'),
    ('can_manage_staff', '', 'staff administration role check'),
    ('can_publish_menu', '', 'build-time publish role check'),
    ('get_admin_operational_state', '', 'operational admin read RPC'),
    ('menu_availability_target_exists', 'target_menu_id text, target_section_id text, target_item_id text', 'availability target universe validation'),
    ('set_menu_availability_overlay', 'menu_id text, section_id text, item_id text, available_override boolean', 'availability overlay upsert RPC'),
    ('clear_menu_availability_overlay', 'menu_id text, section_id text, item_id text', 'availability overlay clear RPC'),
    ('set_profile_service_kind', 'profile_id text, service_kind text', 'active service edit RPC'),
    ('set_daily_menu', 'regular_name text, regular_description text, vegetarian_name text, vegetarian_description text', 'daily menu edit RPC'),
    ('set_global_fixed_price', 'pricing_key text, amount integer', 'fixed price edit RPC'),
    ('set_global_price_variant', 'pricing_key text, variant_id text, amount integer', 'variant price edit RPC'),
    ('add_catalog_item', 'section_id text, item_id text, name text, description text, amount integer', 'fixed menu item add RPC'),
    ('delete_catalog_item', 'section_id text, item_id text', 'fixed menu item delete RPC'),
    ('update_catalog_item', 'section_id text, item_id text, name text, description text', 'fixed menu item text edit RPC'),
    ('add_catalog_item_option', 'section_id text, item_id text, option_id text, name text', 'fixed menu option add RPC'),
    ('delete_catalog_item_option', 'section_id text, item_id text, option_id text', 'fixed menu option delete RPC'),
    ('update_catalog_item_option', 'section_id text, item_id text, option_id text, name text', 'fixed menu option text edit RPC'),
    ('add_grill_product', 'family_id text, title text, item_id text, variant_name text, amount integer', 'grill product add RPC'),
    ('delete_grill_product', 'family_id text', 'grill product delete RPC'),
    ('update_grill_product', 'family_id text, title text', 'grill product text edit RPC'),
    ('add_grill_item', 'family_id text, item_id text, name text, variant_name text, amount integer', 'grill option add RPC'),
    ('delete_grill_item', 'item_id text', 'grill option delete RPC'),
    ('update_grill_item', 'item_id text, name text, variant_name text', 'grill option text edit RPC'),
    ('reserve_menu_publish_request', 'user_id uuid, cooldown_seconds integer', 'private publish reservation helper'),
    ('complete_menu_publish_request', 'request_id bigint, publish_status text, publish_message text, vercel_status_code integer, vercel_job_id text', 'private publish completion helper')
),
actual_functions as (
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select
  expected.function_name,
  expected.identity_arguments,
  case
    when actual.function_name is null then 'missing'
    else 'present'
  end as status,
  expected.expectation
from expected_functions expected
left join actual_functions actual
  on actual.function_name = expected.function_name
 and actual.identity_arguments = expected.identity_arguments
order by expected.function_name;

-- 08b. Security definer functions still executable from exposed API schemas.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  'risk' as suggested_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef = true
  and (
    pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
  and (
    (
      current_setting('pgrst.db_schemas', true) is null
      and n.nspname = 'public'
    )
    or n.nspname = any (
      array(
        select btrim(exposed_schema.schema_name)
        from unnest(string_to_array(current_setting('pgrst.db_schemas', true), ',')) as exposed_schema(schema_name)
      )
    )
  )
order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

-- 09. Publish helper execute privileges.
with expected_publish_helper_grants(function_name, identity_arguments) as (
  values
    ('reserve_menu_publish_request', 'user_id uuid, cooldown_seconds integer'),
    ('complete_menu_publish_request', 'request_id bigint, publish_status text, publish_message text, vercel_status_code integer, vercel_job_id text')
),
actual_functions as (
  select
    p.oid,
    p.proacl,
    p.proowner,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
actual_privileges as (
  select
    actual.oid,
    coalesce(grantee.rolname, 'PUBLIC') as grantee,
    acl.privilege_type
  from actual_functions actual
  cross join lateral aclexplode(coalesce(actual.proacl, acldefault('f', actual.proowner))) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
)
select
  expected.function_name,
  expected.identity_arguments,
  coalesce(bool_or(privilege.grantee = 'service_role' and privilege.privilege_type = 'EXECUTE'), false) as service_role_can_execute,
  coalesce(bool_or(privilege.grantee = 'anon' and privilege.privilege_type = 'EXECUTE'), false) as anon_can_execute,
  coalesce(bool_or(privilege.grantee = 'authenticated' and privilege.privilege_type = 'EXECUTE'), false) as authenticated_can_execute,
  coalesce(bool_or(privilege.grantee = 'PUBLIC' and privilege.privilege_type = 'EXECUTE'), false) as public_can_execute,
  case
    when actual.oid is null then 'missing'
    when coalesce(bool_or(privilege.grantee = 'service_role' and privilege.privilege_type = 'EXECUTE'), false)
      and not coalesce(bool_or(privilege.grantee = 'anon' and privilege.privilege_type = 'EXECUTE'), false)
      and not coalesce(bool_or(privilege.grantee = 'authenticated' and privilege.privilege_type = 'EXECUTE'), false)
      and not coalesce(bool_or(privilege.grantee = 'PUBLIC' and privilege.privilege_type = 'EXECUTE'), false) then 'keep'
    else 'risk'
  end as suggested_status
from expected_publish_helper_grants expected
left join actual_functions actual
  on actual.function_name = expected.function_name
 and actual.identity_arguments = expected.identity_arguments
left join actual_privileges privilege
  on privilege.oid = actual.oid
group by expected.function_name, expected.identity_arguments, actual.oid
order by expected.function_name;

-- 10. Availability overlay targets that do not match possible menu targets.
with possible_targets as (
  select profile.id as menu_id, 'menu-del-dia'::text as section_id, item.item_id
  from menu_content.menu_profiles profile
  cross join menu_content.menu_daily_items item

  union all

  select profile.id, 'parrilla', item.item_id
  from menu_content.menu_profiles profile
  cross join menu_content.menu_grill_catalog_items item

  union all

  select profile.id, item.section_id, item.item_id
  from menu_content.menu_profiles profile
  cross join menu_content.menu_catalog_items item

  union all

  select profile.id, item.section_id, item.item_id || '-' || option.option_id
  from menu_content.menu_profiles profile
  cross join menu_content.menu_catalog_items item
  join menu_content.menu_catalog_item_options option
    on option.catalog_item_id = item.id
)
select
  overlay.menu_id,
  overlay.section_id,
  overlay.item_id,
  'risk' as suggested_status,
  'Availability overlay row does not match a possible menu target.' as reason
from public.menu_availability_overlays overlay
where not exists (
  select 1
  from possible_targets target
  where target.menu_id = overlay.menu_id
    and target.section_id = overlay.section_id
    and target.item_id = overlay.item_id
)
order by overlay.menu_id, overlay.section_id, overlay.item_id;

-- 11. Image paths with invalid format in the active catalog.
select
  'menu_catalog_item_images' as object_name,
  item.section_id,
  null::text as context_id,
  item.item_id,
  image.image_path
from menu_content.menu_catalog_item_images image
join menu_content.menu_catalog_items item
  on item.id = image.catalog_item_id
where not (
  image.image_path like '/uploads/%'
  and image.image_path not like '%//%'
  and image.image_path not like '%\%'
  and image.image_path not like '%?%'
  and image.image_path not like '%#%'
  and image.image_path !~ '(^|/)\.\.?(/|$)'
  and lower(image.image_path) ~ '\.(avif|jpeg|jpg|png|svg|webp)$'
);

-- 11b. Image order must be contiguous from zero for every catalog item.
select
  item.section_id,
  item.item_id,
  min(image.order_index) as minimum_order,
  max(image.order_index) as maximum_order,
  count(*) as image_count
from menu_content.menu_catalog_item_images image
join menu_content.menu_catalog_items item
  on item.id = image.catalog_item_id
group by item.id, item.section_id, item.item_id
having min(image.order_index) <> 0
  or max(image.order_index) + 1 <> count(*);

-- 11c. Legacy item image columns must remain removed.
select
  table_name,
  column_name
from information_schema.columns
where table_schema = 'menu_content'
  and table_name in (
    'menu_catalog_items',
    'menu_daily_items',
    'menu_grill_catalog_items'
  )
  and column_name = 'image_path';

-- 12. Build-time availability must stay normalized to true.
select
  table_name,
  false_count,
  'risk' as suggested_status,
  'Build-time available columns must remain true; runtime unavailability belongs in public.menu_availability_overlays.' as reason
from (
  select 'menu_daily_items' as table_name, count(*)::integer as false_count
  from menu_content.menu_daily_items
  where available is distinct from true

  union all

  select 'menu_price_variants', count(*)::integer
  from menu_content.menu_price_variants
  where available is distinct from true

  union all

  select 'menu_catalog_items', count(*)::integer
  from menu_content.menu_catalog_items
  where available is distinct from true

  union all

  select 'menu_catalog_item_options', count(*)::integer
  from menu_content.menu_catalog_item_options
  where available is distinct from true

  union all

  select 'menu_grill_catalog_items', count(*)::integer
  from menu_content.menu_grill_catalog_items
  where available is distinct from true
) availability_counts
where false_count > 0
order by table_name;
