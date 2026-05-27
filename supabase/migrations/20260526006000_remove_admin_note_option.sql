begin;

create or replace function pg_temp.merge_description_note(
  current_description text,
  current_note text
)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(current_note), '') is null then nullif(btrim(current_description), '')
    when nullif(btrim(current_description), '') is null then nullif(btrim(current_note), '')
    when position(lower(btrim(current_note)) in lower(btrim(current_description))) > 0 then nullif(btrim(current_description), '')
    else btrim(current_description) || ' ' || btrim(current_note)
  end;
$$;

update menu_content.menu_daily_items
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

update menu_content.menu_catalog_sections
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

update menu_content.menu_catalog_groups
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

update menu_content.menu_catalog_items
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

update menu_content.menu_catalog_item_options
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

update menu_content.menu_grill_catalog_items
set
  description = pg_temp.merge_description_note(description, note),
  note = null
where nullif(btrim(coalesce(note, '')), '') is not null;

drop function if exists public.set_daily_menu(text, text, text, text, text, text);
drop function if exists app_private.set_daily_menu(text, text, text, text, text, text);
drop function if exists public.add_catalog_item(text, text, text, text, text, text, integer);
drop function if exists app_private.add_catalog_item(text, text, text, text, text, text, integer);

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
  where item.item_id in ('menu-del-dia', 'menu-vegetariano-del-dia');

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
      or item.note is not null
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
    note = null,
    available = true
  from desired_items desired
  where item.item_id = desired.item_id;

  return query select true, true, true, 'set_daily_menu', 'daily_menu_updated';
end;
$$;

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
              'pricing_key', item.pricing_key,
              'price_amount', price.amount,
              'order_index', item.order_index,
              'option_count', (
                select count(*)
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              ),
              'options', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'section_id', item.section_id,
                    'group_id', item.group_id,
                    'item_id', item.item_id,
                    'option_id', option.option_id,
                    'name', option.name,
                    'description', option.description,
                    'order_index', option.order_index
                  )
                  order by option.order_index, option.option_id
                )
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              ), '[]'::jsonb)
            )
            order by section.order_index, group_entry.order_index nulls first, item.order_index, item.item_id
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
    null,
    null,
    true,
    price_key,
    next_order_index
  );

  return query select true, true, true, 'add_catalog_item', 'catalog_item_added';
end;
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

revoke all on function public.set_daily_menu(text, text, text, text) from public, anon, authenticated;
revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.set_daily_menu(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.get_admin_catalog_editor_state() from public, anon, authenticated;
revoke all on function app_private.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;

grant execute on function public.set_daily_menu(text, text, text, text) to authenticated;
grant execute on function public.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function app_private.set_daily_menu(text, text, text, text) to authenticated;
grant execute on function app_private.get_admin_catalog_editor_state() to authenticated;
grant execute on function app_private.add_catalog_item(text, text, text, text, text, integer) to authenticated;

commit;
