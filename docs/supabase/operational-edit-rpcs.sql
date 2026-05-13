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

-- `can_edit_menu_content()` is introduced by this operational edit RPC phase.
-- It is not a precondition of the earlier staff-users migration. The required
-- preconditions are public.staff_users, can_edit_availability(text),
-- can_manage_staff(), and can_publish_menu().
create or replace function public.can_edit_menu_content()
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
      and staff.role in ('menu_editor', 'admin')
  );
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
  );
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

  if coalesce(row_exists, false) and previous_override = target_available_override then
    return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_unchanged';
    return;
  end if;

  update public.menu_availability_overlays overlay
  set
    available_override = target_available_override,
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
        target_available_override,
        now(),
        (select auth.uid())
      );
    exception
      when unique_violation then
        update public.menu_availability_overlays overlay
        set
          available_override = target_available_override,
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

create or replace function public.set_daily_menu(
  regular_name text,
  regular_description text,
  regular_note text,
  regular_available boolean,
  vegetarian_name text,
  vegetarian_description text,
  vegetarian_note text,
  vegetarian_available boolean
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

  if regular_available is null or vegetarian_available is null then
    return query select false, false, true, 'set_daily_menu', 'daily_menu_available_required';
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
    note,
    available
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value, regular_available),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value, vegetarian_available)
  )
  select exists (
    select 1
    from desired_items desired
    join menu_content.menu_daily_items item
      on item.item_id = desired.item_id
    where item.name is distinct from desired.name
      or item.description is distinct from desired.description
      or item.note is distinct from desired.note
      or item.available is distinct from desired.available
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
    note,
    available
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value, regular_available),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value, vegetarian_available)
  )
  update menu_content.menu_daily_items item
  set
    name = desired.name,
    description = desired.description,
    note = desired.note,
    available = desired.available
  from desired_items desired
  where item.item_id = desired.item_id;

  return query select true, true, true, 'set_daily_menu', 'daily_menu_updated';
end;
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

create or replace function public.set_global_price_variant(
  pricing_key text,
  variant_id text,
  amount integer,
  available boolean
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

  if available is null then
    return query select false, false, true, 'set_global_price_variant', 'available_required';
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

  if current_amount = amount and current_available = available then
    return query select true, false, true, 'set_global_price_variant', 'price_variant_unchanged';
    return;
  end if;

  update menu_content.menu_price_variants variant
  set
    amount = set_global_price_variant.amount,
    available = set_global_price_variant.available
  where variant.pricing_key = pricing_key_value
    and variant.variant_id = variant_id_value;

  return query select true, true, true, 'set_global_price_variant', 'price_variant_updated';
end;
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
revoke all on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_global_fixed_price(text, integer) from public, anon, authenticated;
revoke all on function public.set_global_price_variant(text, text, integer, boolean) from public, anon, authenticated;

grant execute on function public.can_edit_menu_content() to authenticated;
grant execute on function public.set_menu_availability_overlay(text, text, text, text, boolean) to authenticated;
grant execute on function public.clear_menu_availability_overlay(text, text, text, text) to authenticated;
grant execute on function public.set_profile_service_kind(text, text) to authenticated;
grant execute on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) to authenticated;
grant execute on function public.set_global_fixed_price(text, integer) to authenticated;
grant execute on function public.set_global_price_variant(text, text, integer, boolean) to authenticated;

drop policy if exists "Staff can insert menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can update menu availability overlays"
  on public.menu_availability_overlays;
drop policy if exists "Staff can delete menu availability overlays"
  on public.menu_availability_overlays;
