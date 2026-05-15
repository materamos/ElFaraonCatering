begin;

update menu_content.menu_daily_items
set available = true
where available is distinct from true;

update menu_content.menu_catalog_items
set available = true
where available is distinct from true;

update menu_content.menu_catalog_item_options
set available = true
where available is distinct from true;

update menu_content.menu_grill_catalog_items
set available = true
where available is distinct from true;

update menu_content.menu_price_variants
set available = true
where available is distinct from true;

delete from public.menu_availability_overlays
where available_override is true;

drop function if exists public.set_daily_menu(text, text, text, boolean, text, text, text, boolean);
drop function if exists public.set_global_price_variant(text, text, integer, boolean);
drop function if exists app_private.set_daily_menu(text, text, text, boolean, text, text, text, boolean);
drop function if exists app_private.set_global_price_variant(text, text, integer, boolean);

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

create or replace function app_private.set_daily_menu(
  regular_name text,
  regular_description text,
  regular_note text,
  vegetarian_name text,
  vegetarian_description text,
  vegetarian_note text
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
  regular_note_value text := nullif(btrim(set_daily_menu.regular_note), '');
  vegetarian_name_value text := nullif(btrim(set_daily_menu.vegetarian_name), '');
  vegetarian_description_value text := nullif(btrim(set_daily_menu.vegetarian_description), '');
  vegetarian_note_value text := nullif(btrim(set_daily_menu.vegetarian_note), '');
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
    description,
    note
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value)
  )
  select exists (
    select 1
    from desired_items desired
    join menu_content.menu_daily_items item
      on item.item_id = desired.item_id
    where item.name is distinct from desired.name
      or item.description is distinct from desired.description
      or item.note is distinct from desired.note
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
    description,
    note
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value)
  )
  update menu_content.menu_daily_items item
  set
    name = desired.name,
    description = desired.description,
    note = desired.note,
    available = true
  from desired_items desired
  where item.item_id = desired.item_id;

  return query select true, true, true, 'set_daily_menu', 'daily_menu_updated';
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

create or replace function public.set_daily_menu(
  regular_name text,
  regular_description text,
  regular_note text,
  vegetarian_name text,
  vegetarian_description text,
  vegetarian_note text
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
  from app_private.set_daily_menu($1, $2, $3, $4, $5, $6);
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

create or replace function app_private.get_admin_operational_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
declare
  staff_row public.staff_users%rowtype;
  state jsonb;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'unauthorized',
      'staff', null,
      'permissions', jsonb_build_object(
        'can_edit_availability', false,
        'can_edit_menu_content', false,
        'can_publish_menu', false,
        'can_manage_staff', false
      ),
      'profiles', '[]'::jsonb,
      'service_settings', '[]'::jsonb,
      'daily_menu', '[]'::jsonb,
      'availability_targets', '[]'::jsonb,
      'availability_overlays', '[]'::jsonb,
      'prices', jsonb_build_object('fixed', '[]'::jsonb, 'variants', '[]'::jsonb)
    );
  end if;

  select *
  into staff_row
  from public.staff_users staff
  where staff.user_id = (select auth.uid())
    and staff.active = true;

  if staff_row.user_id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'staff_access_denied',
      'staff', null,
      'permissions', jsonb_build_object(
        'can_edit_availability', false,
        'can_edit_menu_content', false,
        'can_publish_menu', false,
        'can_manage_staff', false
      ),
      'profiles', '[]'::jsonb,
      'service_settings', '[]'::jsonb,
      'daily_menu', '[]'::jsonb,
      'availability_targets', '[]'::jsonb,
      'availability_overlays', '[]'::jsonb,
      'prices', jsonb_build_object('fixed', '[]'::jsonb, 'variants', '[]'::jsonb)
    );
  end if;

  with visible_profiles as (
    select profile.*
    from menu_content.menu_profiles profile
    where staff_row.role in ('menu_editor', 'admin')
      or staff_row.profile_id is null
      or profile.id = staff_row.profile_id
  ),
  profile_permissions as (
    select
      profile.id,
      profile.eyebrow,
      profile.title,
      profile.description,
      public.can_edit_availability(profile.id) as can_edit_availability
    from visible_profiles profile
  ),
  daily_targets as (
    select
      profile.id as menu_id,
      profile.title as profile_title,
      'daily-menu'::text as target_kind,
      'menu-del-dia'::text as section_id,
      'Menu del dia'::text as section_title,
      ''::text as group_id,
      null::text as group_title,
      item.item_id,
      item.name,
      item.description,
      true as base_available,
      null::integer as price_amount,
      0 as target_kind_order,
      0 as section_order_index,
      null::integer as group_order_index,
      item.order_index as item_order_index
    from visible_profiles profile
    cross join menu_content.menu_daily_items item
    where public.can_edit_availability(profile.id)
  ),
  grill_targets as (
    select
      profile.id as menu_id,
      profile.title as profile_title,
      'grill'::text as target_kind,
      'parrilla'::text as section_id,
      'Parrilla'::text as section_title,
      ''::text as group_id,
      family.title as group_title,
      item.item_id,
      coalesce(nullif(btrim(item.variant_name), ''), item.name) as name,
      item.description,
      true as base_available,
      price.amount as price_amount,
      1 as target_kind_order,
      0 as section_order_index,
      family.order_index as group_order_index,
      item.order_index as item_order_index
    from visible_profiles profile
    cross join menu_content.menu_grill_catalog_items item
    join menu_content.menu_grill_families family
      on family.family_id = item.family_id
    join menu_content.menu_prices price
      on price.pricing_key = item.pricing_key
     and price.kind = 'fixed'
    where public.can_edit_availability(profile.id)
  ),
  catalog_targets as (
    select
      profile.id as menu_id,
      profile.title as profile_title,
      'catalog'::text as target_kind,
      item.section_id,
      section.title as section_title,
      item.group_id,
      group_entry.title as group_title,
      item.item_id,
      item.name,
      item.description,
      true as base_available,
      null::integer as price_amount,
      2 as target_kind_order,
      section.order_index as section_order_index,
      group_entry.order_index as group_order_index,
      item.order_index as item_order_index
    from visible_profiles profile
    cross join menu_content.menu_catalog_items item
    join menu_content.menu_catalog_sections section
      on section.section_id = item.section_id
    left join menu_content.menu_catalog_groups group_entry
      on group_entry.section_id = item.section_id
     and group_entry.group_id = item.group_id
    where public.can_edit_availability(profile.id)
  ),
  catalog_option_targets as (
    select
      profile.id as menu_id,
      profile.title as profile_title,
      'catalog'::text as target_kind,
      item.section_id,
      section.title as section_title,
      item.group_id,
      group_entry.title as group_title,
      item.item_id || '-' || option.option_id as item_id,
      item.name || ' - ' || option.name as name,
      option.description,
      true as base_available,
      null::integer as price_amount,
      2 as target_kind_order,
      section.order_index as section_order_index,
      group_entry.order_index as group_order_index,
      (item.order_index * 1000) + option.order_index + 1 as item_order_index
    from visible_profiles profile
    cross join menu_content.menu_catalog_items item
    join menu_content.menu_catalog_item_options option
      on option.catalog_item_id = item.id
    join menu_content.menu_catalog_sections section
      on section.section_id = item.section_id
    left join menu_content.menu_catalog_groups group_entry
      on group_entry.section_id = item.section_id
     and group_entry.group_id = item.group_id
    where public.can_edit_availability(profile.id)
  ),
  availability_targets as (
    select * from daily_targets
    union all
    select * from grill_targets
    union all
    select * from catalog_targets
    union all
    select * from catalog_option_targets
  )
  select jsonb_build_object(
    'ok', true,
    'message', 'ok',
    'staff', jsonb_build_object(
      'user_id', staff_row.user_id,
      'display_name', staff_row.display_name,
      'role', staff_row.role,
      'profile_id', staff_row.profile_id,
      'active', staff_row.active
    ),
    'permissions', jsonb_build_object(
      'can_edit_availability', staff_row.role in ('availability_editor', 'admin'),
      'can_edit_menu_content', public.can_edit_menu_content(),
      'can_publish_menu', public.can_publish_menu(),
      'can_manage_staff', public.can_manage_staff()
    ),
    'profiles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'eyebrow', profile.eyebrow,
          'title', profile.title,
          'description', profile.description,
          'can_edit_availability', profile.can_edit_availability
        )
        order by profile.id
      )
      from profile_permissions profile
    ), '[]'::jsonb),
    'service_settings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', settings.profile_id,
          'service_kind', settings.service_kind
        )
        order by settings.profile_id
      )
      from menu_content.menu_profile_service_settings settings
      join visible_profiles profile
        on profile.id = settings.profile_id
    ), '[]'::jsonb),
    'daily_menu', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_id', item.item_id,
          'name', item.name,
          'description', item.description,
          'note', item.note,
          'pricing_key', item.pricing_key,
          'order_index', item.order_index
        )
        order by item.order_index
      )
      from menu_content.menu_daily_items item
    ), '[]'::jsonb),
    'availability_targets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'menu_id', target.menu_id,
          'profile_title', target.profile_title,
          'target_kind', target.target_kind,
          'section_id', target.section_id,
          'section_title', target.section_title,
          'group_id', target.group_id,
          'group_title', target.group_title,
          'item_id', target.item_id,
          'name', target.name,
          'description', target.description,
          'base_available', target.base_available,
          'price_amount', target.price_amount
        )
        order by target.menu_id, target.target_kind_order, target.section_order_index, target.group_order_index nulls first, target.item_order_index, target.item_id
      )
      from availability_targets target
    ), '[]'::jsonb),
    'availability_overlays', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'menu_id', overlay.menu_id,
          'section_id', overlay.section_id,
          'group_id', coalesce(overlay.group_id, ''),
          'item_id', overlay.item_id,
          'available_override', overlay.available_override,
          'updated_at', overlay.updated_at
        )
        order by overlay.menu_id, overlay.section_id, coalesce(overlay.group_id, ''), overlay.item_id
      )
      from public.menu_availability_overlays overlay
      join visible_profiles profile
        on profile.id = overlay.menu_id
      where public.can_edit_availability(profile.id)
    ), '[]'::jsonb),
    'prices', jsonb_build_object(
      'fixed', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'pricing_key', price.pricing_key,
            'amount', price.amount
          )
          order by price.pricing_key
        )
        from menu_content.menu_prices price
        where price.kind = 'fixed'
          and public.can_edit_menu_content()
      ), '[]'::jsonb),
      'variants', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'pricing_key', variant.pricing_key,
            'variant_id', variant.variant_id,
            'name', variant.name,
            'amount', variant.amount,
            'order_index', variant.order_index
          )
          order by variant.pricing_key, variant.order_index
        )
        from menu_content.menu_price_variants variant
        join menu_content.menu_prices price
          on price.pricing_key = variant.pricing_key
         and price.kind = 'variants'
        where public.can_edit_menu_content()
      ), '[]'::jsonb)
    )
  )
  into state;

  return state;
end;
$$;

revoke all on function public.set_daily_menu(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_global_price_variant(text, text, integer) from public, anon, authenticated;
revoke all on function app_private.set_daily_menu(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_global_price_variant(text, text, integer) from public, anon, authenticated;
revoke all on function app_private.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.get_admin_operational_state() from public, anon, authenticated;

grant execute on function public.set_daily_menu(text, text, text, text, text, text) to authenticated;
grant execute on function public.set_global_price_variant(text, text, integer) to authenticated;
grant execute on function app_private.set_daily_menu(text, text, text, text, text, text) to authenticated;
grant execute on function app_private.set_global_price_variant(text, text, integer) to authenticated;
grant execute on function app_private.menu_availability_target_exists(text, text, text, text) to authenticated;
grant execute on function app_private.get_admin_operational_state() to authenticated;

commit;
