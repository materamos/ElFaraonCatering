begin;

create or replace function app_private.get_admin_catalog_editor_state()
returns jsonb
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  select case
    when not public.can_edit_menu_content() then
      jsonb_build_object(
        'sections', '[]'::jsonb,
        'groups', '[]'::jsonb,
        'items', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'sections', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', section.section_id,
              'title', section.title,
              'content_kind', section.content_kind,
              'order_index', section.order_index,
              'item_count', (
                select count(*)
                from menu_content.menu_catalog_items item
                where item.section_id = section.section_id
              )
            )
            order by section.order_index
          )
          from menu_content.menu_catalog_sections section
        ), '[]'::jsonb),
        'groups', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', group_entry.section_id,
              'group_id', group_entry.group_id,
              'title', group_entry.title,
              'pricing_key', group_entry.pricing_key,
              'order_index', group_entry.order_index,
              'item_count', (
                select count(*)
                from menu_content.menu_catalog_items item
                where item.section_id = group_entry.section_id
                  and item.group_id = group_entry.group_id
              )
            )
            order by group_entry.section_id, group_entry.order_index
          )
          from menu_content.menu_catalog_groups group_entry
        ), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', item.section_id,
              'section_title', section.title,
              'group_id', item.group_id,
              'group_title', group_entry.title,
              'item_id', item.item_id,
              'name', item.name,
              'description', item.description,
              'note', item.note,
              'pricing_key', item.pricing_key,
              'price_amount', price.amount,
              'order_index', item.order_index,
              'option_count', (
                select count(*)
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              )
            )
            order by section.order_index, group_entry.order_index nulls first, item.order_index
          )
          from menu_content.menu_catalog_items item
          join menu_content.menu_catalog_sections section
            on section.section_id = item.section_id
          left join menu_content.menu_catalog_groups group_entry
            on group_entry.section_id = item.section_id
           and group_entry.group_id = item.group_id
          left join menu_content.menu_prices price
            on price.pricing_key = item.pricing_key
           and price.kind = 'fixed'
        ), '[]'::jsonb)
      )
  end;
$$;

create or replace function app_private.add_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text,
  note text,
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
  target_note text := nullif(btrim(add_catalog_item.note), '');
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

    insert into menu_content.menu_prices (
      pricing_key,
      kind,
      amount
    )
    values (
      price_key,
      'fixed',
      target_amount
    )
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
    note,
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
    target_note,
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
    and not exists (
      select 1 from menu_content.menu_daily_items item where item.pricing_key = target_pricing_key
    )
    and not exists (
      select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = target_pricing_key
    )
    and not exists (
      select 1 from menu_content.menu_catalog_items item where item.pricing_key = target_pricing_key
    )
    and not exists (
      select 1 from menu_content.menu_grill_catalog_items item where item.pricing_key = target_pricing_key
    ) then
    delete from menu_content.menu_prices price
    where price.pricing_key = target_pricing_key;
  end if;

  return query select true, true, true, 'delete_catalog_item', 'catalog_item_deleted';
end;
$$;

create or replace function public.get_admin_operational_state()
returns jsonb
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.get_admin_operational_state()
    || jsonb_build_object('catalog_editor', app_private.get_admin_catalog_editor_state());
$$;

create or replace function public.add_catalog_item(
  section_id text,
  group_id text,
  item_id text,
  name text,
  description text,
  note text,
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
  from app_private.add_catalog_item($1, $2, $3, $4, $5, $6, $7);
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

revoke all on function public.get_admin_operational_state() from public, anon, authenticated;
revoke all on function public.add_catalog_item(text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.delete_catalog_item(text, text, text) from public, anon, authenticated;
revoke all on function app_private.get_admin_catalog_editor_state() from public, anon, authenticated;
revoke all on function app_private.add_catalog_item(text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item(text, text, text) from public, anon, authenticated;

grant execute on function public.get_admin_operational_state() to authenticated;
grant execute on function public.add_catalog_item(text, text, text, text, text, text, integer) to authenticated;
grant execute on function public.delete_catalog_item(text, text, text) to authenticated;
grant execute on function app_private.get_admin_catalog_editor_state() to authenticated;
grant execute on function app_private.add_catalog_item(text, text, text, text, text, text, integer) to authenticated;
grant execute on function app_private.delete_catalog_item(text, text, text) to authenticated;

commit;
