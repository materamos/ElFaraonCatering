begin;

do $$
begin
  if to_regclass('public.staff_users') is null then
    raise exception 'public.staff_users is required before admin operational state can be installed.';
  end if;

  if to_regclass('public.menu_availability_overlays') is null then
    raise exception 'public.menu_availability_overlays is required before admin operational state can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_edit_availability'
      and pg_get_function_identity_arguments(p.oid) = 'target_profile_id text'
  ) then
    raise exception 'public.can_edit_availability(text) is required before admin operational state can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_edit_menu_content'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    raise exception 'public.can_edit_menu_content() is required before admin operational state can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_manage_staff'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    raise exception 'public.can_manage_staff() is required before admin operational state can be installed.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_publish_menu'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    raise exception 'public.can_publish_menu() is required before admin operational state can be installed.';
  end if;
end $$;

create or replace function public.get_admin_operational_state()
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
      item.available as base_available,
      null::integer as price_amount,
      item.order_index
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
      item.available as base_available,
      price.amount as price_amount,
      item.order_index
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
      item.available as base_available,
      null::integer as price_amount,
      item.order_index
    from visible_profiles profile
    cross join menu_content.menu_catalog_items item
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
          'available', item.available,
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
        order by target.menu_id, target.target_kind, target.section_id, target.group_title nulls first, target.order_index, target.item_id
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
            'available', variant.available,
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

revoke all on function public.get_admin_operational_state() from public, anon, authenticated;
grant execute on function public.get_admin_operational_state() to authenticated;

commit;
