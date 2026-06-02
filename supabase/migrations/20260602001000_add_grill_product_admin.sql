begin;

create or replace function app_private.add_grill_product(
  family_id text,
  title text,
  item_id text,
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
  target_family_id text := nullif(btrim(add_grill_product.family_id), '');
  target_title text := nullif(btrim(add_grill_product.title), '');
  target_item_id text := nullif(btrim(add_grill_product.item_id), '');
  target_variant_name text := nullif(btrim(add_grill_product.variant_name), '');
  target_amount integer := add_grill_product.amount;
  price_key text;
  price_kind text;
  next_family_order_index integer;
  next_item_order_index integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_grill_product', 'permission_denied';
    return;
  end if;

  if target_family_id is null then
    return query select false, false, true, 'add_grill_product', 'grill_product_id_required';
    return;
  end if;

  if target_family_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return query select false, false, true, 'add_grill_product', 'invalid_grill_product_id';
    return;
  end if;

  if target_title is null then
    return query select false, false, true, 'add_grill_product', 'grill_product_name_required';
    return;
  end if;

  if target_item_id is null then
    return query select false, false, true, 'add_grill_product', 'grill_item_id_required';
    return;
  end if;

  if target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return query select false, false, true, 'add_grill_product', 'invalid_grill_item_id';
    return;
  end if;

  if target_variant_name is null then
    return query select false, false, true, 'add_grill_product', 'grill_option_name_required';
    return;
  end if;

  if target_amount is null or target_amount < 0 then
    return query select false, false, true, 'add_grill_product', 'invalid_amount';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_families family
    where family.family_id = target_family_id
  ) then
    return query select false, false, true, 'add_grill_product', 'grill_product_exists';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_grill_catalog_items item
    where item.item_id = target_item_id
  ) then
    return query select false, false, true, 'add_grill_product', 'grill_item_exists';
    return;
  end if;

  price_key := 'parrilla-' || target_item_id;

  select price.kind
  into price_kind
  from menu_content.menu_prices price
  where price.pricing_key = price_key;

  if price_kind is not null and price_kind <> 'fixed' then
    return query select false, false, true, 'add_grill_product', 'grill_price_key_conflict';
    return;
  end if;

  select coalesce(max(family.order_index), -1) + 1
  into next_family_order_index
  from menu_content.menu_grill_families family;

  select coalesce(max(item.order_index), -1) + 1
  into next_item_order_index
  from menu_content.menu_grill_catalog_items item;

  insert into menu_content.menu_grill_families (
    family_id,
    title,
    order_index
  )
  values (
    target_family_id,
    target_title,
    next_family_order_index
  );

  insert into menu_content.menu_prices (pricing_key, kind, amount)
  values (price_key, 'fixed', target_amount)
  on conflict (pricing_key) do update
  set amount = excluded.amount
  where menu_content.menu_prices.kind = 'fixed';

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
    target_variant_name,
    target_variant_name,
    null,
    true,
    price_key,
    next_item_order_index
  );

  return query select true, true, true, 'add_grill_product', 'grill_product_added';
end;
$$;

create or replace function app_private.update_grill_product(
  family_id text,
  title text
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
  target_family_id text := nullif(btrim(update_grill_product.family_id), '');
  target_title text := nullif(btrim(update_grill_product.title), '');
  current_title text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_grill_product', 'permission_denied';
    return;
  end if;

  if target_family_id is null then
    return query select false, false, true, 'update_grill_product', 'grill_product_id_required';
    return;
  end if;

  if target_title is null then
    return query select false, false, true, 'update_grill_product', 'grill_product_name_required';
    return;
  end if;

  select family.title
  into current_title
  from menu_content.menu_grill_families family
  where family.family_id = target_family_id;

  if current_title is null then
    return query select false, false, true, 'update_grill_product', 'grill_family_not_found';
    return;
  end if;

  if current_title is not distinct from target_title then
    return query select true, false, true, 'update_grill_product', 'grill_product_unchanged';
    return;
  end if;

  update menu_content.menu_grill_families family
  set title = target_title
  where family.family_id = target_family_id;

  return query select true, true, true, 'update_grill_product', 'grill_product_updated';
end;
$$;

create or replace function app_private.delete_grill_product(
  family_id text
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
  target_family_id text := nullif(btrim(delete_grill_product.family_id), '');
  target_item_ids text[];
  target_pricing_keys text[];
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_grill_product', 'permission_denied';
    return;
  end if;

  if target_family_id is null then
    return query select false, false, true, 'delete_grill_product', 'grill_product_id_required';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_grill_families family
    where family.family_id = target_family_id
  ) then
    return query select false, false, true, 'delete_grill_product', 'grill_family_not_found';
    return;
  end if;

  select
    coalesce(array_agg(item.item_id order by item.order_index), array[]::text[]),
    coalesce(array_agg(item.pricing_key order by item.order_index), array[]::text[])
  into target_item_ids, target_pricing_keys
  from menu_content.menu_grill_catalog_items item
  where item.family_id = target_family_id;

  delete from public.menu_availability_overlays overlay
  where overlay.section_id = 'parrilla'
    and overlay.item_id = any(target_item_ids);

  delete from menu_content.menu_grill_catalog_items item
  where item.family_id = target_family_id;

  delete from menu_content.menu_grill_families family
  where family.family_id = target_family_id;

  delete from menu_content.menu_prices price
  where price.pricing_key = any(target_pricing_keys)
    and not exists (select 1 from menu_content.menu_daily_items item where item.pricing_key = price.pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = price.pricing_key)
    and not exists (select 1 from menu_content.menu_catalog_items item where item.pricing_key = price.pricing_key)
    and not exists (select 1 from menu_content.menu_grill_catalog_items item where item.pricing_key = price.pricing_key);

  return query select true, true, true, 'delete_grill_product', 'grill_product_deleted';
end;
$$;

create or replace function public.add_grill_product(
  family_id text,
  title text,
  item_id text,
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
  from app_private.add_grill_product($1, $2, $3, $4, $5);
$$;

create or replace function public.update_grill_product(
  family_id text,
  title text
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
  from app_private.update_grill_product($1, $2);
$$;

create or replace function public.delete_grill_product(
  family_id text
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
  from app_private.delete_grill_product($1);
$$;

revoke all on function app_private.add_grill_product(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.update_grill_product(text, text) from public, anon, authenticated;
revoke all on function app_private.delete_grill_product(text) from public, anon, authenticated;
revoke all on function public.add_grill_product(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.update_grill_product(text, text) from public, anon, authenticated;
revoke all on function public.delete_grill_product(text) from public, anon, authenticated;

grant execute on function app_private.add_grill_product(text, text, text, text, integer) to authenticated;
grant execute on function app_private.update_grill_product(text, text) to authenticated;
grant execute on function app_private.delete_grill_product(text) to authenticated;
grant execute on function public.add_grill_product(text, text, text, text, integer) to authenticated;
grant execute on function public.update_grill_product(text, text) to authenticated;
grant execute on function public.delete_grill_product(text) to authenticated;

commit;
