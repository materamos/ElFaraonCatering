begin;

create or replace function app_private.normalize_visible_name(value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized text := lower(regexp_replace(btrim(coalesce(normalize_visible_name.value, '')), '\s+', ' ', 'g'));
begin
  return translate(
    normalized,
    chr(225) || chr(224) || chr(228) || chr(226) || chr(227) ||
    chr(233) || chr(232) || chr(235) || chr(234) ||
    chr(237) || chr(236) || chr(239) || chr(238) ||
    chr(243) || chr(242) || chr(246) || chr(244) || chr(245) ||
    chr(250) || chr(249) || chr(252) || chr(251) ||
    chr(241) || chr(231),
    'aaaaaeeeeiiiiooooouuuunc'
  );
end;
$$;

create unique index if not exists menu_catalog_items_location_visible_name_key
  on menu_content.menu_catalog_items (
    section_id,
    group_id,
    app_private.normalize_visible_name(name)
  );

create unique index if not exists menu_catalog_item_options_item_visible_name_key
  on menu_content.menu_catalog_item_options (
    catalog_item_id,
    app_private.normalize_visible_name(name)
  );

create unique index if not exists menu_grill_families_visible_title_key
  on menu_content.menu_grill_families (
    app_private.normalize_visible_name(title)
  );

create unique index if not exists menu_grill_catalog_items_family_visible_name_key
  on menu_content.menu_grill_catalog_items (
    family_id,
    app_private.normalize_visible_name(coalesce(variant_name, name))
  );

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
      and app_private.normalize_visible_name(item.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_exists';
    return;
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
    if target_group_id = '' then
      price_key := 'catalog:' || target_section_id || ':item:' || target_item_id || ':price';
    else
      price_key := 'catalog:' || target_section_id || ':group:' || target_group_id || ':item:' || target_item_id || ':price';
    end if;

    select price.kind
    into price_kind
    from menu_content.menu_prices price
    where price.pricing_key = price_key;

    if target_section_id = 'guarniciones' then
      if price_kind is not null and price_kind <> 'included' then
        return query select false, false, true, 'add_catalog_item', 'catalog_price_key_conflict';
        return;
      end if;

      insert into menu_content.menu_prices (pricing_key, kind, amount)
      values (price_key, 'included', null)
      on conflict (pricing_key) do update
      set kind = excluded.kind,
        amount = excluded.amount
      where menu_content.menu_prices.kind = 'included';
    else
      if target_amount is null or target_amount < 0 then
        return query select false, false, true, 'add_catalog_item', 'invalid_amount';
        return;
      end if;

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

create or replace function app_private.add_catalog_item_option(
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
  target_section_id text := nullif(btrim(add_catalog_item_option.section_id), '');
  target_group_id text := coalesce(nullif(btrim(add_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(add_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(add_catalog_item_option.option_id), '');
  target_name text := nullif(btrim(add_catalog_item_option.name), '');
  target_catalog_item_id bigint;
  target_item_name text;
  existing_option_count integer;
  next_order_index integer;
  is_side_option_item boolean;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_id_required';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_name_required';
    return;
  end if;

  if target_section_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or target_option_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (target_group_id <> '' and target_group_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then
    return query select false, false, true, 'add_catalog_item_option', 'invalid_catalog_option_id';
    return;
  end if;

  select item.id, item.name
  into target_catalog_item_id, target_item_name
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  select count(*)
  into existing_option_count
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id;

  if existing_option_count = 0 then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_options_not_enabled';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and app_private.normalize_visible_name(option.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id = target_option_id
  ) then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  is_side_option_item :=
    target_section_id = 'guarniciones'
    or target_item_id in ('guarnicion', 'guarniciones', 'guarnicion-sola')
    or lower(target_item_name) in ('guarnicion', 'guarniciones');

  if is_side_option_item then
    select max(option.order_index)
    into next_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id;

    update menu_content.menu_catalog_item_options option
    set order_index = option.order_index + 1
    where option.catalog_item_id = target_catalog_item_id
      and option.order_index >= next_order_index;
  else
    select coalesce(max(option.order_index), -1) + 1
    into next_order_index
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id;
  end if;

  insert into menu_content.menu_catalog_item_options (
    catalog_item_id,
    option_id,
    name,
    available,
    order_index
  )
  values (
    target_catalog_item_id,
    target_option_id,
    target_name,
    true,
    next_order_index
  );

  return query select true, true, true, 'add_catalog_item_option', 'catalog_option_added';
end;
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

  if exists (
    select 1
    from menu_content.menu_grill_catalog_items item
    where item.family_id = target_family_id
      and app_private.normalize_visible_name(coalesce(item.variant_name, item.name))
        = app_private.normalize_visible_name(coalesce(target_variant_name, target_name))
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
    from menu_content.menu_grill_families family
    where app_private.normalize_visible_name(family.title) = app_private.normalize_visible_name(target_title)
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

revoke all on function app_private.normalize_visible_name(text) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.add_grill_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.add_grill_product(text, text, text, text, integer) from public, anon, authenticated;

grant execute on function app_private.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function app_private.add_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function app_private.add_grill_item(text, text, text, text, integer) to authenticated;
grant execute on function app_private.add_grill_product(text, text, text, text, integer) to authenticated;

commit;
