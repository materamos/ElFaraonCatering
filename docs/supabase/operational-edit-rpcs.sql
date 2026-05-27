do $$
begin
  if to_regclass('public.staff_users') is null then
    raise exception 'public.staff_users is required before operational edit RPCs can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_edit_availability'
      and pg_get_function_identity_arguments(p.oid) = 'target_profile_id text'
  ) then
    raise exception 'public.can_edit_availability(text) is required before operational edit RPCs can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_manage_staff'
  ) then
    raise exception 'public.can_manage_staff() is required before operational edit RPCs can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_publish_menu'
  ) then
    raise exception 'public.can_publish_menu() is required before operational edit RPCs can be installed.';
  end if;
end $$;

create schema if not exists app_private;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

-- `can_edit_menu_content()` is introduced by this operational edit RPC phase.
-- It is not a precondition of the earlier staff-users migration. The required
-- preconditions are public.staff_users, can_edit_availability(text),
-- can_manage_staff(), and can_publish_menu().
-- Privileged operational edit bodies live outside exposed API schemas.
create or replace function app_private.can_edit_menu_content()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_users staff
    where staff.user_id = (select auth.uid())
      and staff.active = true
      and staff.role in ('operator', 'admin')
  );
$$;

create or replace function app_private.menu_availability_target_exists(
  target_menu_id text,
  target_section_id text,
  target_group_id text,
  target_item_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  select exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_daily_items item
    where profile.id = target_menu_id
      and target_section_id = 'menu-del-dia'
      and coalesce(nullif(btrim(target_group_id), ''), '') = ''
      and item.item_id = target_item_id
  )
  or exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_grill_catalog_items item
    where profile.id = target_menu_id
      and target_section_id = 'parrilla'
      and coalesce(nullif(btrim(target_group_id), ''), '') = ''
      and item.item_id = target_item_id
  )
  or exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_catalog_items item
    where profile.id = target_menu_id
      and item.section_id = target_section_id
      and item.group_id = coalesce(nullif(btrim(target_group_id), ''), '')
      and item.item_id = target_item_id
  )
  or exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_catalog_items item
    join menu_content.menu_catalog_item_options option
      on option.catalog_item_id = item.id
    where profile.id = target_menu_id
      and item.section_id = target_section_id
      and item.group_id = coalesce(nullif(btrim(target_group_id), ''), '')
      and item.item_id || '-' || option.option_id = target_item_id
  );
$$;

create or replace function app_private.set_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text,
  available_override boolean
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_menu_id text := set_menu_availability_overlay.menu_id;
  target_section_id text := set_menu_availability_overlay.section_id;
  target_group_id text := nullif(btrim(set_menu_availability_overlay.group_id), '');
  target_item_id text := set_menu_availability_overlay.item_id;
  target_available_override boolean := set_menu_availability_overlay.available_override;
  previous_override boolean;
  row_exists boolean;
  updated_count integer := 0;
begin
  if target_available_override is null then
    return query select false, false, false, 'set_menu_availability_overlay', 'available_override_required';
    return;
  end if;

  if target_available_override is true then
    return query
    select *
    from app_private.clear_menu_availability_overlay(
      target_menu_id,
      target_section_id,
      target_group_id,
      target_item_id
    );
    return;
  end if;

  if not public.menu_availability_target_exists(
    target_menu_id,
    target_section_id,
    target_group_id,
    target_item_id
  ) then
    return query select false, false, false, 'set_menu_availability_overlay', 'invalid_availability_target';
    return;
  end if;

  if not public.can_edit_availability(target_menu_id) then
    return query select false, false, false, 'set_menu_availability_overlay', 'permission_denied';
    return;
  end if;

  select true, overlay.available_override
  into row_exists, previous_override
  from public.menu_availability_overlays overlay
  where overlay.menu_id = target_menu_id
    and overlay.section_id = target_section_id
    and coalesce(overlay.group_id, '') = coalesce(target_group_id, '')
    and overlay.item_id = target_item_id;

  if coalesce(row_exists, false) and previous_override is false then
    return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_unchanged';
    return;
  end if;

  update public.menu_availability_overlays overlay
  set
    available_override = false,
    updated_at = now(),
    updated_by = (select auth.uid())
  where overlay.menu_id = target_menu_id
    and overlay.section_id = target_section_id
    and coalesce(overlay.group_id, '') = coalesce(target_group_id, '')
    and overlay.item_id = target_item_id;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    begin
      insert into public.menu_availability_overlays (
        menu_id,
        section_id,
        group_id,
        item_id,
        available_override,
        updated_at,
        updated_by
      )
      values (
        target_menu_id,
        target_section_id,
        target_group_id,
        target_item_id,
        false,
        now(),
        (select auth.uid())
      );
    exception
      when unique_violation then
        update public.menu_availability_overlays overlay
        set
          available_override = false,
          updated_at = now(),
          updated_by = (select auth.uid())
        where overlay.menu_id = target_menu_id
          and overlay.section_id = target_section_id
          and coalesce(overlay.group_id, '') = coalesce(target_group_id, '')
          and overlay.item_id = target_item_id;
    end;
  end if;

  return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_updated';
end;
$$;

create or replace function app_private.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_menu_id text := clear_menu_availability_overlay.menu_id;
  target_section_id text := clear_menu_availability_overlay.section_id;
  target_group_id text := nullif(btrim(clear_menu_availability_overlay.group_id), '');
  target_item_id text := clear_menu_availability_overlay.item_id;
  deleted_count integer := 0;
begin
  if not public.menu_availability_target_exists(
    target_menu_id,
    target_section_id,
    target_group_id,
    target_item_id
  ) then
    return query select false, false, false, 'clear_menu_availability_overlay', 'invalid_availability_target';
    return;
  end if;

  if not public.can_edit_availability(target_menu_id) then
    return query select false, false, false, 'clear_menu_availability_overlay', 'permission_denied';
    return;
  end if;

  delete from public.menu_availability_overlays overlay
  where overlay.menu_id = target_menu_id
    and overlay.section_id = target_section_id
    and coalesce(overlay.group_id, '') = coalesce(target_group_id, '')
    and overlay.item_id = target_item_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    return query select true, false, false, 'clear_menu_availability_overlay', 'availability_overlay_not_found';
    return;
  end if;

  return query select true, true, false, 'clear_menu_availability_overlay', 'availability_overlay_cleared';
end;
$$;

create or replace function app_private.set_profile_service_kind(
  profile_id text,
  service_kind text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_profile_id text := set_profile_service_kind.profile_id;
  target_service_kind text := set_profile_service_kind.service_kind;
  current_service_kind text;
  updated_count integer := 0;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'set_profile_service_kind', 'permission_denied';
    return;
  end if;

  if target_service_kind not in ('daily-menu', 'grill') then
    return query select false, false, true, 'set_profile_service_kind', 'invalid_service_kind';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_profiles profile
    where profile.id = target_profile_id
  ) then
    return query select false, false, true, 'set_profile_service_kind', 'profile_not_found';
    return;
  end if;

  select settings.service_kind
  into current_service_kind
  from menu_content.menu_profile_service_settings settings
  where settings.profile_id = target_profile_id;

  if current_service_kind = target_service_kind then
    return query select true, false, true, 'set_profile_service_kind', 'service_kind_unchanged';
    return;
  end if;

  update menu_content.menu_profile_service_settings settings
  set service_kind = target_service_kind
  where settings.profile_id = target_profile_id;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    begin
      insert into menu_content.menu_profile_service_settings (
        profile_id,
        service_kind
      )
      values (
        target_profile_id,
        target_service_kind
      );
    exception
      when unique_violation then
        update menu_content.menu_profile_service_settings settings
        set service_kind = target_service_kind
        where settings.profile_id = target_profile_id;
    end;
  end if;

  return query select true, true, true, 'set_profile_service_kind', 'service_kind_updated';
end;
$$;

create or replace function app_private.set_daily_menu(
  regular_name text,
  regular_description text,
  vegetarian_name text,
  vegetarian_description text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  regular_name_value text := nullif(btrim(set_daily_menu.regular_name), '');
  regular_description_value text := nullif(btrim(set_daily_menu.regular_description), '');
  vegetarian_name_value text := nullif(btrim(set_daily_menu.vegetarian_name), '');
  vegetarian_description_value text := nullif(btrim(set_daily_menu.vegetarian_description), '');
  expected_item_count integer;
  has_changes boolean;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'set_daily_menu', 'permission_denied';
    return;
  end if;

  if regular_name_value is null or vegetarian_name_value is null then
    return query select false, false, true, 'set_daily_menu', 'daily_menu_name_required';
    return;
  end if;

  select count(*)
  into expected_item_count
  from menu_content.menu_daily_items item
  where item.item_id in (
    'menu-del-dia',
    'menu-vegetariano-del-dia'
  );

  if expected_item_count <> 2 then
    return query select false, false, true, 'set_daily_menu', 'daily_menu_model_incomplete';
    return;
  end if;

  with desired_items (
    item_id,
    name,
    description
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value)
  )
  select exists (
    select 1
    from desired_items desired
    join menu_content.menu_daily_items item
      on item.item_id = desired.item_id
    where item.name is distinct from desired.name
      or item.description is distinct from desired.description
      or item.available is distinct from true
  )
  into has_changes;

  if not has_changes then
    return query select true, false, true, 'set_daily_menu', 'daily_menu_unchanged';
    return;
  end if;

  with desired_items (
    item_id,
    name,
    description
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value)
  )
  update menu_content.menu_daily_items item
  set
    name = desired.name,
    description = desired.description,
    available = true
  from desired_items desired
  where item.item_id = desired.item_id;

  return query select true, true, true, 'set_daily_menu', 'daily_menu_updated';
end;
$$;

create or replace function app_private.set_global_fixed_price(
  pricing_key text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  pricing_key_value text := nullif(btrim(set_global_fixed_price.pricing_key), '');
  current_kind text;
  current_amount integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'set_global_fixed_price', 'permission_denied';
    return;
  end if;

  if pricing_key_value is null then
    return query select false, false, true, 'set_global_fixed_price', 'pricing_key_required';
    return;
  end if;

  if amount is null or amount < 0 then
    return query select false, false, true, 'set_global_fixed_price', 'invalid_amount';
    return;
  end if;

  select price.kind, price.amount
  into current_kind, current_amount
  from menu_content.menu_prices price
  where price.pricing_key = pricing_key_value;

  if current_kind is null then
    return query select false, false, true, 'set_global_fixed_price', 'price_not_found';
    return;
  end if;

  if current_kind <> 'fixed' then
    return query select false, false, true, 'set_global_fixed_price', 'price_kind_not_fixed';
    return;
  end if;

  if current_amount = amount then
    return query select true, false, true, 'set_global_fixed_price', 'price_unchanged';
    return;
  end if;

  update menu_content.menu_prices price
  set amount = set_global_fixed_price.amount
  where price.pricing_key = pricing_key_value
    and price.kind = 'fixed';

  return query select true, true, true, 'set_global_fixed_price', 'price_updated';
end;
$$;

create or replace function app_private.set_global_price_variant(
  pricing_key text,
  variant_id text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  pricing_key_value text := nullif(btrim(set_global_price_variant.pricing_key), '');
  variant_id_value text := nullif(btrim(set_global_price_variant.variant_id), '');
  current_amount integer;
  current_available boolean;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'set_global_price_variant', 'permission_denied';
    return;
  end if;

  if pricing_key_value is null or variant_id_value is null then
    return query select false, false, true, 'set_global_price_variant', 'variant_key_required';
    return;
  end if;

  if amount is null or amount < 0 then
    return query select false, false, true, 'set_global_price_variant', 'invalid_amount';
    return;
  end if;

  select variant.amount, variant.available
  into current_amount, current_available
  from menu_content.menu_price_variants variant
  where variant.pricing_key = pricing_key_value
    and variant.variant_id = variant_id_value;

  if current_amount is null then
    return query select false, false, true, 'set_global_price_variant', 'price_variant_not_found';
    return;
  end if;

  if current_amount = amount and current_available is true then
    return query select true, false, true, 'set_global_price_variant', 'price_variant_unchanged';
    return;
  end if;

  update menu_content.menu_price_variants variant
  set
    amount = set_global_price_variant.amount,
    available = true
  where variant.pricing_key = pricing_key_value
    and variant.variant_id = variant_id_value;

  return query select true, true, true, 'set_global_price_variant', 'price_variant_updated';
end;
$$;

create or replace function app_private.add_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(add_catalog_item.section_id), '');
  target_group_id text := coalesce(nullif(btrim(add_catalog_item.group_id), ''), '');
  target_item_id text := nullif(btrim(add_catalog_item.item_id), '');
  target_name text := nullif(btrim(add_catalog_item.name), '');
  target_description text := nullif(btrim(add_catalog_item.description), '');
  target_amount integer := add_catalog_item.amount;
  section_kind text;
  group_pricing_key text;
  price_key text;
  price_kind text;
  next_order_index integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_id_required';
    return;
  end if;

  if target_section_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (target_group_id <> '' and target_group_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then
    return query select false, false, true, 'add_catalog_item', 'invalid_catalog_item_id';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_name_required';
    return;
  end if;

  select section.content_kind
  into section_kind
  from menu_content.menu_catalog_sections section
  where section.section_id = target_section_id;

  if section_kind is null then
    return query select false, false, true, 'add_catalog_item', 'catalog_section_not_found';
    return;
  end if;

  if section_kind = 'items' and target_group_id <> '' then
    return query select false, false, true, 'add_catalog_item', 'invalid_catalog_group';
    return;
  end if;

  if section_kind = 'groups' then
    if target_group_id = '' then
      return query select false, false, true, 'add_catalog_item', 'catalog_group_required';
      return;
    end if;

    select group_entry.pricing_key
    into group_pricing_key
    from menu_content.menu_catalog_groups group_entry
    where group_entry.section_id = target_section_id
      and group_entry.group_id = target_group_id;

    if not found then
      return query select false, false, true, 'add_catalog_item', 'catalog_group_not_found';
      return;
    end if;
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and item.group_id = target_group_id
      and item.item_id = target_item_id
  ) then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_exists';
    return;
  end if;

  if section_kind = 'items' or group_pricing_key is null then
    if target_amount is null or target_amount < 0 then
      return query select false, false, true, 'add_catalog_item', 'invalid_amount';
      return;
    end if;

    if target_group_id = '' then
      price_key := 'catalog:' || target_section_id || ':item:' || target_item_id || ':price';
    else
      price_key := 'catalog:' || target_section_id || ':group:' || target_group_id || ':item:' || target_item_id || ':price';
    end if;

    select price.kind
    into price_kind
    from menu_content.menu_prices price
    where price.pricing_key = price_key;

    if price_kind is not null and price_kind <> 'fixed' then
      return query select false, false, true, 'add_catalog_item', 'catalog_price_key_conflict';
      return;
    end if;

    insert into menu_content.menu_prices (pricing_key, kind, amount)
    values (price_key, 'fixed', target_amount)
    on conflict (pricing_key) do update
    set amount = excluded.amount
    where menu_content.menu_prices.kind = 'fixed';
  end if;

  select coalesce(max(item.order_index) + 1, 0)
  into next_order_index
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id;

  insert into menu_content.menu_catalog_items (
    section_id,
    group_id,
    item_id,
    name,
    description,
    image_path,
    available,
    pricing_key,
    order_index
  )
  values (
    target_section_id,
    target_group_id,
    target_item_id,
    target_name,
    target_description,
    null,
    true,
    price_key,
    next_order_index
  );

  return query select true, true, true, 'add_catalog_item', 'catalog_item_added';
end;
$$;

create or replace function app_private.delete_catalog_item(
  section_id text,
  group_id text,
  item_id text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(delete_catalog_item.section_id), '');
  target_group_id text := coalesce(nullif(btrim(delete_catalog_item.group_id), ''), '');
  target_item_id text := nullif(btrim(delete_catalog_item.item_id), '');
  target_catalog_item_id bigint;
  target_pricing_key text;
  sibling_count integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_catalog_item', 'permission_denied';
    return;
  end if;

  select item.id, item.pricing_key
  into target_catalog_item_id, target_pricing_key
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'delete_catalog_item', 'catalog_item_not_found';
    return;
  end if;

  select count(*)
  into sibling_count
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id;

  if sibling_count <= 1 then
    return query select false, false, true, 'delete_catalog_item', 'catalog_location_must_keep_item';
    return;
  end if;

  delete from public.menu_availability_overlays overlay
  where overlay.section_id = target_section_id
    and coalesce(overlay.group_id, '') = target_group_id
    and overlay.item_id in (
      select target_item_id
      union all
      select target_item_id || '-' || option.option_id
      from menu_content.menu_catalog_item_options option
      where option.catalog_item_id = target_catalog_item_id
    );

  delete from menu_content.menu_catalog_items item
  where item.id = target_catalog_item_id;

  if target_pricing_key is not null
    and not exists (select 1 from menu_content.menu_daily_items item where item.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_items item where item.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_grill_catalog_items item where item.pricing_key = target_pricing_key) then
    delete from menu_content.menu_prices price
    where price.pricing_key = target_pricing_key;
  end if;

  return query select true, true, true, 'delete_catalog_item', 'catalog_item_deleted';
end;
$$;

create or replace function app_private.update_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(update_catalog_item.section_id), '');
  target_group_id text := coalesce(nullif(btrim(update_catalog_item.group_id), ''), '');
  target_item_id text := nullif(btrim(update_catalog_item.item_id), '');
  target_name text := nullif(btrim(update_catalog_item.name), '');
  target_description text := nullif(btrim(update_catalog_item.description), '');
  current_name text;
  current_description text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_name_required';
    return;
  end if;

  select item.name, item.description
  into current_name, current_description
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if current_name is null then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_not_found';
    return;
  end if;

  if current_name is not distinct from target_name
    and current_description is not distinct from target_description then
    return query select true, false, true, 'update_catalog_item', 'catalog_item_unchanged';
    return;
  end if;

  update menu_content.menu_catalog_items item
  set
    name = target_name,
    description = target_description
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  return query select true, true, true, 'update_catalog_item', 'catalog_item_updated';
end;
$$;

create or replace function app_private.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
  name text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language plpgsql
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(update_catalog_item_option.section_id), '');
  target_group_id text := coalesce(nullif(btrim(update_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(update_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(update_catalog_item_option.option_id), '');
  target_name text := nullif(btrim(update_catalog_item_option.name), '');
  target_catalog_item_id bigint;
  current_name text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_name_required';
    return;
  end if;

  select item.id
  into target_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  select option.name
  into current_name
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  if current_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_not_found';
    return;
  end if;

  if current_name is not distinct from target_name then
    return query select true, false, true, 'update_catalog_item_option', 'catalog_option_unchanged';
    return;
  end if;

  update menu_content.menu_catalog_item_options option
  set name = target_name
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  return query select true, true, true, 'update_catalog_item_option', 'catalog_option_updated';
end;
$$;

-- Public client-facing RPCs are security-invoker wrappers around app_private.
create or replace function public.can_edit_menu_content()
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.can_edit_menu_content();
$$;

create or replace function public.menu_availability_target_exists(
  target_menu_id text,
  target_section_id text,
  target_group_id text,
  target_item_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.menu_availability_target_exists($1, $2, $3, $4);
$$;

create or replace function public.set_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text,
  available_override boolean
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_menu_availability_overlay($1, $2, $3, $4, $5);
$$;

create or replace function public.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
  group_id text,
  item_id text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.clear_menu_availability_overlay($1, $2, $3, $4);
$$;

create or replace function public.set_profile_service_kind(
  profile_id text,
  service_kind text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_profile_service_kind($1, $2);
$$;

create or replace function public.set_daily_menu(
  regular_name text,
  regular_description text,
  vegetarian_name text,
  vegetarian_description text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_daily_menu($1, $2, $3, $4);
$$;

create or replace function public.set_global_fixed_price(
  pricing_key text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_global_fixed_price($1, $2);
$$;

create or replace function public.set_global_price_variant(
  pricing_key text,
  variant_id text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.set_global_price_variant($1, $2, $3);
$$;

create or replace function public.add_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text,
  amount integer
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.add_catalog_item($1, $2, $3, $4, $5, $6);
$$;

create or replace function public.delete_catalog_item(
  section_id text,
  group_id text,
  item_id text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.delete_catalog_item($1, $2, $3);
$$;

create or replace function public.update_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.update_catalog_item($1, $2, $3, $4, $5);
$$;

create or replace function public.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
  name text
)
returns table (
  ok boolean,
  changed boolean,
  requires_redeploy boolean,
  operation text,
  message text
)
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.update_catalog_item_option($1, $2, $3, $4, $5);
$$;

revoke all on public.menu_availability_overlays from anon, authenticated;
grant select (
  menu_id,
  section_id,
  group_id,
  item_id,
  available_override
) on public.menu_availability_overlays to anon, authenticated;

revoke all on function public.can_edit_menu_content() from public, anon, authenticated;
revoke all on function public.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_profile_service_kind(text, text) from public, anon, authenticated;
revoke all on function public.set_daily_menu(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_global_fixed_price(text, integer) from public, anon, authenticated;
revoke all on function public.set_global_price_variant(text, text, integer) from public, anon, authenticated;
revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.delete_catalog_item(text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.can_edit_menu_content() to authenticated;
grant execute on function public.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function public.clear_menu_availability_overlay(text, text, text, text) to authenticated;
grant execute on function public.set_profile_service_kind(text, text) to authenticated;
grant execute on function public.set_daily_menu(text, text, text, text) to authenticated;
grant execute on function public.set_global_fixed_price(text, integer) to authenticated;
grant execute on function public.set_global_price_variant(text, text, integer) to authenticated;
grant execute on function public.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function public.delete_catalog_item(text, text, text) to authenticated;
grant execute on function public.update_catalog_item(text, text, text, text, text) to authenticated;
grant execute on function public.update_catalog_item_option(text, text, text, text, text) to authenticated;

revoke all on function app_private.can_edit_menu_content() from public, anon, authenticated;
revoke all on function app_private.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_profile_service_kind(text, text) from public, anon, authenticated;
revoke all on function app_private.set_daily_menu(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_global_fixed_price(text, integer) from public, anon, authenticated;
revoke all on function app_private.set_global_price_variant(text, text, integer) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item(text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;

grant execute on function app_private.can_edit_menu_content() to authenticated;
grant execute on function app_private.menu_availability_target_exists(text, text, text, text) to authenticated;
grant execute on function app_private.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function app_private.clear_menu_availability_overlay(text, text, text, text) to authenticated;
grant execute on function app_private.set_profile_service_kind(text, text) to authenticated;
grant execute on function app_private.set_daily_menu(text, text, text, text) to authenticated;
grant execute on function app_private.set_global_fixed_price(text, integer) to authenticated;
grant execute on function app_private.set_global_price_variant(text, text, integer) to authenticated;
grant execute on function app_private.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function app_private.delete_catalog_item(text, text, text) to authenticated;
grant execute on function app_private.update_catalog_item(text, text, text, text, text) to authenticated;
grant execute on function app_private.update_catalog_item_option(text, text, text, text, text) to authenticated;

drop policy if exists "Staff can insert menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can update menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can delete menu availability overlays"
  on public.menu_availability_overlays;
