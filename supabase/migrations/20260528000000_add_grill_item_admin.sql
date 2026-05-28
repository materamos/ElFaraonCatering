begin;

create or replace function app_private.get_admin_grill_editor_state()
returns jsonb
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  select jsonb_build_object(
    'families', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'family_id', family.family_id,
          'title', family.title,
          'order_index', family.order_index,
          'item_count', (
            select count(*)::integer
            from menu_content.menu_grill_catalog_items item
            where item.family_id = family.family_id
          )
        )
        order by family.order_index, family.family_id
      )
      from menu_content.menu_grill_families family
      where public.can_edit_menu_content()
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'family_id', item.family_id,
          'family_title', family.title,
          'item_id', item.item_id,
          'name', item.name,
          'variant_name', item.variant_name,
          'pricing_key', item.pricing_key,
          'price_amount', price.amount,
          'order_index', item.order_index
        )
        order by family.order_index, item.order_index, item.item_id
      )
      from menu_content.menu_grill_catalog_items item
      join menu_content.menu_grill_families family
        on family.family_id = item.family_id
      join menu_content.menu_prices price
        on price.pricing_key = item.pricing_key
       and price.kind = 'fixed'
      where public.can_edit_menu_content()
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_admin_operational_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.get_admin_operational_state()
    || jsonb_build_object(
      'catalog_editor', app_private.get_admin_catalog_editor_state(),
      'grill_editor', app_private.get_admin_grill_editor_state()
    );
$$;

create or replace function app_private.add_grill_item(
  family_id text,
  item_id text,
  name text,
  variant_name text,
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
  target_family_id text := nullif(btrim(add_grill_item.family_id), '');
  target_item_id text := nullif(btrim(add_grill_item.item_id), '');
  target_name text := nullif(btrim(add_grill_item.name), '');
  target_variant_name text := nullif(btrim(add_grill_item.variant_name), '');
  target_amount integer := add_grill_item.amount;
  price_key text;
  price_kind text;
  next_order_index integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_grill_item', 'permission_denied';
    return;
  end if;

  if target_item_id is null then
    return query select false, false, true, 'add_grill_item', 'grill_item_id_required';
    return;
  end if;

  if target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return query select false, false, true, 'add_grill_item', 'invalid_grill_item_id';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'add_grill_item', 'grill_item_name_required';
    return;
  end if;

  if target_amount is null or target_amount < 0 then
    return query select false, false, true, 'add_grill_item', 'invalid_amount';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_grill_families family
    where family.family_id = target_family_id
  ) then
    return query select false, false, true, 'add_grill_item', 'grill_family_not_found';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_catalog_items item
    where item.item_id = target_item_id
  ) then
    return query select false, false, true, 'add_grill_item', 'grill_item_exists';
    return;
  end if;

  price_key := 'parrilla-' || target_item_id;

  select price.kind
  into price_kind
  from menu_content.menu_prices price
  where price.pricing_key = price_key;

  if price_kind is not null and price_kind <> 'fixed' then
    return query select false, false, true, 'add_grill_item', 'grill_price_key_conflict';
    return;
  end if;

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  values (price_key, 'fixed', target_amount)
  on conflict (pricing_key) do update
  set amount = excluded.amount
  where menu_content.menu_prices.kind = 'fixed';

  select coalesce(max(item.order_index), -1) + 1
  into next_order_index
  from menu_content.menu_grill_catalog_items item;

  insert into menu_content.menu_grill_catalog_items (
    family_id,
    item_id,
    name,
    variant_name,
    image_path,
    available,
    pricing_key,
    order_index
  )
  values (
    target_family_id,
    target_item_id,
    target_name,
    target_variant_name,
    null,
    true,
    price_key,
    next_order_index
  );

  return query select true, true, true, 'add_grill_item', 'grill_item_added';
end;
$$;

create or replace function app_private.update_grill_item(
  item_id text,
  name text,
  variant_name text
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
  target_item_id text := nullif(btrim(update_grill_item.item_id), '');
  target_name text := nullif(btrim(update_grill_item.name), '');
  target_variant_name text := nullif(btrim(update_grill_item.variant_name), '');
  current_name text;
  current_variant_name text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_grill_item', 'permission_denied';
    return;
  end if;

  if target_item_id is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_name_required';
    return;
  end if;

  select item.name, item.variant_name
  into current_name, current_variant_name
  from menu_content.menu_grill_catalog_items item
  where item.item_id = target_item_id;

  if current_name is null then
    return query select false, false, true, 'update_grill_item', 'grill_item_not_found';
    return;
  end if;

  if current_name is not distinct from target_name
    and current_variant_name is not distinct from target_variant_name then
    return query select true, false, true, 'update_grill_item', 'grill_item_unchanged';
    return;
  end if;

  update menu_content.menu_grill_catalog_items item
  set
    name = target_name,
    variant_name = target_variant_name
  where item.item_id = target_item_id;

  return query select true, true, true, 'update_grill_item', 'grill_item_updated';
end;
$$;

create or replace function app_private.delete_grill_item(
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
  target_item_id text := nullif(btrim(delete_grill_item.item_id), '');
  target_family_id text;
  target_pricing_key text;
  family_item_count integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_grill_item', 'permission_denied';
    return;
  end if;

  select item.family_id, item.pricing_key
  into target_family_id, target_pricing_key
  from menu_content.menu_grill_catalog_items item
  where item.item_id = target_item_id;

  if target_family_id is null then
    return query select false, false, true, 'delete_grill_item', 'grill_item_not_found';
    return;
  end if;

  select count(*)::integer
  into family_item_count
  from menu_content.menu_grill_catalog_items item
  where item.family_id = target_family_id;

  if family_item_count <= 1 then
    return query select false, false, true, 'delete_grill_item', 'grill_family_must_keep_item';
    return;
  end if;

  delete from menu_content.menu_grill_catalog_items item
  where item.item_id = target_item_id;

  if target_pricing_key is not null
    and not exists (select 1 from menu_content.menu_daily_items item where item.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_items item where item.pricing_key = target_pricing_key)
    and not exists (select 1 from menu_content.menu_grill_catalog_items item where item.pricing_key = target_pricing_key) then
    delete from menu_content.menu_prices price
    where price.pricing_key = target_pricing_key;
  end if;

  return query select true, true, true, 'delete_grill_item', 'grill_item_deleted';
end;
$$;

create or replace function public.add_grill_item(
  family_id text,
  item_id text,
  name text,
  variant_name text,
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
  from app_private.add_grill_item($1, $2, $3, $4, $5);
$$;

create or replace function public.update_grill_item(
  item_id text,
  name text,
  variant_name text
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
  from app_private.update_grill_item($1, $2, $3);
$$;

create or replace function public.delete_grill_item(
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
  from app_private.delete_grill_item($1);
$$;

revoke all on function app_private.get_admin_grill_editor_state() from public, anon, authenticated;
revoke all on function public.get_admin_operational_state() from public, anon, authenticated;
revoke all on function app_private.add_grill_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.update_grill_item(text, text, text) from public, anon, authenticated;
revoke all on function app_private.delete_grill_item(text) from public, anon, authenticated;
revoke all on function public.add_grill_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.update_grill_item(text, text, text) from public, anon, authenticated;
revoke all on function public.delete_grill_item(text) from public, anon, authenticated;

grant execute on function app_private.get_admin_grill_editor_state() to authenticated;
grant execute on function public.get_admin_operational_state() to authenticated;
grant execute on function app_private.add_grill_item(text, text, text, text, integer) to authenticated;
grant execute on function app_private.update_grill_item(text, text, text) to authenticated;
grant execute on function app_private.delete_grill_item(text) to authenticated;
grant execute on function public.add_grill_item(text, text, text, text, integer) to authenticated;
grant execute on function public.update_grill_item(text, text, text) to authenticated;
grant execute on function public.delete_grill_item(text) to authenticated;

commit;
