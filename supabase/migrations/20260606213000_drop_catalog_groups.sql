begin;

do $$
begin
  if exists (select 1 from menu_content.menu_catalog_groups) then
    raise exception 'menu_catalog_groups must be empty before removing catalog groups.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_sections section
    where section.content_kind <> 'items'
  ) then
    raise exception 'All catalog sections must use content_kind = items before removing catalog groups.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.group_id <> ''
  ) then
    raise exception 'All catalog items must use an empty group_id before removing catalog groups.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_groups group_entry
    where group_entry.pricing_key is not null
      and not exists (
        select 1
        from menu_content.menu_daily_items item
        where item.pricing_key = group_entry.pricing_key
      )
      and not exists (
        select 1
        from menu_content.menu_catalog_items item
        where item.pricing_key = group_entry.pricing_key
      )
      and not exists (
        select 1
        from menu_content.menu_grill_catalog_items item
        where item.pricing_key = group_entry.pricing_key
      )
  ) then
    raise exception 'A price is referenced exclusively by a catalog group.';
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.pricing_key is null
  ) then
    raise exception 'Every catalog item must define pricing_key before removing inherited group pricing.';
  end if;
end $$;

revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.delete_catalog_item(text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_catalog_item_option(text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;

drop function public.add_catalog_item(text, text, text, text, text, integer);
drop function public.delete_catalog_item(text, text, text);
drop function public.update_catalog_item(text, text, text, text, text);
drop function public.add_catalog_item_option(text, text, text, text, text);
drop function public.delete_catalog_item_option(text, text, text, text);
drop function public.update_catalog_item_option(text, text, text, text, text);

revoke all on function app_private.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item(text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item_option(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;

drop function app_private.add_catalog_item(text, text, text, text, text, integer);
drop function app_private.delete_catalog_item(text, text, text);
drop function app_private.update_catalog_item(text, text, text, text, text);
drop function app_private.add_catalog_item_option(text, text, text, text, text);
drop function app_private.delete_catalog_item_option(text, text, text, text);
drop function app_private.update_catalog_item_option(text, text, text, text, text);

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
      and coalesce(nullif(btrim(target_group_id), ''), '') = ''
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
      and coalesce(nullif(btrim(target_group_id), ''), '') = ''
      and item.item_id || '-' || option.option_id = target_item_id
  );
$$;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('app_private.get_admin_operational_state()'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'      item.group_id,\n      group_entry.title as group_title,',
    E'      ''''::text as group_id,\n      null::text as group_title,'
  );
  updated_definition := replace(
    updated_definition,
    E'      group_entry.order_index as group_order_index,',
    E'      null::integer as group_order_index,'
  );
  updated_definition := regexp_replace(
    updated_definition,
    E'\\n    left join menu_content\\.menu_catalog_groups group_entry\\n      on group_entry\\.section_id = item\\.section_id\\n     and group_entry\\.group_id = item\\.group_id',
    '',
    'g'
  );

  if current_definition = updated_definition
    or updated_definition like '%menu_catalog_groups%'
    or updated_definition like '%item.group_id%' then
    raise exception 'Could not remove catalog group references from app_private.get_admin_operational_state().';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.delete_grill_item(text)'::regprocedure)
  into current_definition;
  updated_definition := replace(
    current_definition,
    E'\n    and not exists (select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = target_pricing_key)',
    ''
  );

  if current_definition = updated_definition then
    raise exception 'Could not remove catalog group dependency from app_private.delete_grill_item(text).';
  end if;

  execute updated_definition;

  select pg_get_functiondef('app_private.delete_grill_product(text)'::regprocedure)
  into current_definition;
  updated_definition := replace(
    current_definition,
    E'\n    and not exists (select 1 from menu_content.menu_catalog_groups group_entry where group_entry.pricing_key = price.pricing_key)',
    ''
  );

  if current_definition = updated_definition then
    raise exception 'Could not remove catalog group dependency from app_private.delete_grill_product(text).';
  end if;

  execute updated_definition;
end $$;

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
        'items', '[]'::jsonb
      )
    else
      jsonb_build_object(
        'sections', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', section.section_id,
              'title', section.title,
              'order_index', section.order_index,
              'item_count', (
                select count(*)
                from menu_content.menu_catalog_items item
                where item.section_id = section.section_id
              )
            )
            order by section.order_index, section.section_id
          )
          from menu_content.menu_catalog_sections section
        ), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'section_id', item.section_id,
              'section_title', section.title,
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
                    'item_id', item.item_id,
                    'option_id', option.option_id,
                    'name', option.name,
                    'order_index', option.order_index
                  )
                  order by option.order_index, option.option_id
                )
                from menu_content.menu_catalog_item_options option
                where option.catalog_item_id = item.id
              ), '[]'::jsonb)
            )
            order by section.order_index, item.order_index, item.item_id
          )
          from menu_content.menu_catalog_items item
          join menu_content.menu_catalog_sections section
            on section.section_id = item.section_id
          left join menu_content.menu_prices price
            on price.pricing_key = item.pricing_key
           and price.kind = 'fixed'
        ), '[]'::jsonb)
      )
  end;
$$;

create or replace function app_private.get_menu_publication_content_hash()
returns text
language sql
stable
security definer
set search_path = public, menu_content, pg_temp
as $$
  with content as (
    select jsonb_build_object(
      'profiles', coalesce((
        select jsonb_agg(to_jsonb(profile) order by profile.id)
        from menu_content.menu_profiles profile
      ), '[]'::jsonb),
      'profile_facts', coalesce((
        select jsonb_agg(to_jsonb(fact) order by fact.profile_id, fact.order_index, fact.fact_id)
        from menu_content.menu_profile_facts fact
      ), '[]'::jsonb),
      'prices', coalesce((
        select jsonb_agg(to_jsonb(price) order by price.pricing_key)
        from menu_content.menu_prices price
      ), '[]'::jsonb),
      'price_variants', coalesce((
        select jsonb_agg(to_jsonb(variant) order by variant.pricing_key, variant.order_index, variant.variant_id)
        from menu_content.menu_price_variants variant
      ), '[]'::jsonb),
      'daily_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_daily_items item
      ), '[]'::jsonb),
      'profile_service_settings', coalesce((
        select jsonb_agg(to_jsonb(settings) order by settings.profile_id)
        from menu_content.menu_profile_service_settings settings
      ), '[]'::jsonb),
      'catalog_sections', coalesce((
        select jsonb_agg(to_jsonb(section) order by section.order_index, section.section_id)
        from menu_content.menu_catalog_sections section
      ), '[]'::jsonb),
      'catalog_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.section_id, item.order_index, item.item_id)
        from menu_content.menu_catalog_items item
      ), '[]'::jsonb),
      'catalog_item_options', coalesce((
        select jsonb_agg(to_jsonb(option_entry) order by option_entry.catalog_item_id, option_entry.order_index, option_entry.option_id)
        from menu_content.menu_catalog_item_options option_entry
      ), '[]'::jsonb),
      'grill_families', coalesce((
        select jsonb_agg(to_jsonb(family) order by family.order_index, family.family_id)
        from menu_content.menu_grill_families family
      ), '[]'::jsonb),
      'grill_items', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.order_index, item.item_id)
        from menu_content.menu_grill_catalog_items item
      ), '[]'::jsonb)
    ) as data
  )
  select md5(content.data::text)
  from content;
$$;

drop index if exists menu_content.menu_catalog_items_location_visible_name_key;

alter table menu_content.menu_catalog_items
  drop constraint if exists menu_catalog_items_section_id_group_id_item_id_key,
  drop constraint if exists menu_catalog_items_section_id_group_id_order_index_key,
  alter column pricing_key set not null,
  drop column group_id;

alter table menu_content.menu_catalog_sections
  drop column content_kind;

drop table menu_content.menu_catalog_groups;

alter table menu_content.menu_catalog_items
  add constraint menu_catalog_items_section_id_item_id_key unique (section_id, item_id),
  add constraint menu_catalog_items_section_id_order_index_key unique (section_id, order_index);

create unique index menu_catalog_items_section_visible_name_key
  on menu_content.menu_catalog_items (
    section_id,
    app_private.normalize_visible_name(name)
  );

create or replace function app_private.add_catalog_item(
  section_id text,
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
  target_item_id text := nullif(btrim(add_catalog_item.item_id), '');
  target_name text := nullif(btrim(add_catalog_item.name), '');
  target_description text := nullif(btrim(add_catalog_item.description), '');
  target_amount integer := add_catalog_item.amount;
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
    or target_item_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return query select false, false, true, 'add_catalog_item', 'invalid_catalog_item_id';
    return;
  end if;

  if target_name is null then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_name_required';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_catalog_sections section
    where section.section_id = target_section_id
  ) then
    return query select false, false, true, 'add_catalog_item', 'catalog_section_not_found';
    return;
  end if;

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and (
        item.item_id = target_item_id
        or app_private.normalize_visible_name(item.name) = app_private.normalize_visible_name(target_name)
      )
  ) then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_exists';
    return;
  end if;

  price_key := 'catalog:' || target_section_id || ':item:' || target_item_id || ':price';

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

  select coalesce(max(item.order_index) + 1, 0)
  into next_order_index
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id;

  insert into menu_content.menu_catalog_items (
    section_id,
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
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'delete_catalog_item', 'catalog_item_not_found';
    return;
  end if;

  select count(*)
  into sibling_count
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id;

  if sibling_count <= 1 then
    return query select false, false, true, 'delete_catalog_item', 'catalog_location_must_keep_item';
    return;
  end if;

  delete from public.menu_availability_overlays overlay
  where overlay.section_id = target_section_id
    and overlay.item_id in (
      select target_item_id
      union all
      select target_item_id || '-' || option.option_id
      from menu_content.menu_catalog_item_options option
      where option.catalog_item_id = target_catalog_item_id
    );

  delete from menu_content.menu_catalog_items item
  where item.id = target_catalog_item_id;

  if not exists (select 1 from menu_content.menu_daily_items item where item.pricing_key = target_pricing_key)
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

  if exists (
    select 1
    from menu_content.menu_catalog_items item
    where item.section_id = target_section_id
      and item.item_id <> target_item_id
      and app_private.normalize_visible_name(item.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_exists';
    return;
  end if;

  begin
    update menu_content.menu_catalog_items item
    set
      name = target_name,
      description = target_description
    where item.section_id = target_section_id
      and item.item_id = target_item_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_catalog_item', 'catalog_item_exists';
      return;
  end;

  return query select true, true, true, 'update_catalog_item', 'catalog_item_updated';
end;
$$;

create or replace function app_private.add_catalog_item_option(
  section_id text,
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
    or target_option_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return query select false, false, true, 'add_catalog_item_option', 'invalid_catalog_option_id';
    return;
  end if;

  select item.id, item.name
  into target_catalog_item_id, target_item_name
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
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
      and (
        option.option_id = target_option_id
        or app_private.normalize_visible_name(option.name) = app_private.normalize_visible_name(target_name)
      )
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

create or replace function app_private.delete_catalog_item_option(
  section_id text,
  item_id text,
  option_id text
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
  target_section_id text := nullif(btrim(delete_catalog_item_option.section_id), '');
  target_item_id text := nullif(btrim(delete_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(delete_catalog_item_option.option_id), '');
  target_catalog_item_id bigint;
  existing_option_count integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_catalog_item_option', 'permission_denied';
    return;
  end if;

  select item.id
  into target_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'delete_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  if not exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id = target_option_id
  ) then
    return query select false, false, true, 'delete_catalog_item_option', 'catalog_option_not_found';
    return;
  end if;

  select count(*)
  into existing_option_count
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id;

  if existing_option_count <= 1 then
    return query select false, false, true, 'delete_catalog_item_option', 'catalog_option_must_keep_one';
    return;
  end if;

  delete from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  return query select true, true, true, 'delete_catalog_item_option', 'catalog_option_deleted';
end;
$$;

create or replace function app_private.update_catalog_item_option(
  section_id text,
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

  if target_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_name_required';
    return;
  end if;

  select item.id
  into target_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
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

  if exists (
    select 1
    from menu_content.menu_catalog_item_options option
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id <> target_option_id
      and app_private.normalize_visible_name(option.name) = app_private.normalize_visible_name(target_name)
  ) then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  begin
    update menu_content.menu_catalog_item_options option
    set name = target_name
    where option.catalog_item_id = target_catalog_item_id
      and option.option_id = target_option_id;
  exception
    when unique_violation then
      return query select false, false, true, 'update_catalog_item_option', 'catalog_option_exists';
      return;
  end;

  return query select true, true, true, 'update_catalog_item_option', 'catalog_option_updated';
end;
$$;

create or replace function public.add_catalog_item(
  section_id text,
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
security invoker
set search_path = public, app_private, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(add_catalog_item.section_id), '');
  ignored_item_id text := nullif(btrim(add_catalog_item.item_id), '');
begin
  if ignored_item_id is not null then
    null;
  end if;

  if not public.can_edit_menu_content() then
    return query select false, false, true, 'add_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id in ('tartas-tortillas-omelettes', 'empanadas') then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query
  select *
  from app_private.add_catalog_item(
    $1,
    app_private.generate_admin_id('item'),
    $3,
    $4,
    $5
  );
end;
$$;

create or replace function public.delete_catalog_item(
  section_id text,
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
security invoker
set search_path = public, app_private, pg_temp
as $$
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_catalog_item', 'permission_denied';
    return;
  end if;

  if nullif(btrim(delete_catalog_item.section_id), '') in ('tartas-tortillas-omelettes', 'empanadas') then
    return query select false, false, true, 'delete_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query select * from app_private.delete_catalog_item($1, $2);
end;
$$;

create or replace function public.update_catalog_item(
  section_id text,
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
security invoker
set search_path = public, app_private, pg_temp
as $$
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item', 'permission_denied';
    return;
  end if;

  if nullif(btrim(update_catalog_item.section_id), '') in ('tartas-tortillas-omelettes', 'empanadas') then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query select * from app_private.update_catalog_item($1, $2, $3, $4);
end;
$$;

create or replace function public.add_catalog_item_option(
  section_id text,
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
  from app_private.add_catalog_item_option(
    $1,
    $2,
    app_private.generate_admin_id('option'),
    $4
  );
$$;

create or replace function public.delete_catalog_item_option(
  section_id text,
  item_id text,
  option_id text
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
  select * from app_private.delete_catalog_item_option($1, $2, $3);
$$;

create or replace function public.update_catalog_item_option(
  section_id text,
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
  select * from app_private.update_catalog_item_option($1, $2, $3, $4);
$$;

revoke all on function public.add_catalog_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.delete_catalog_item(text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item(text, text, text, text) from public, anon, authenticated;
revoke all on function public.add_catalog_item_option(text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_catalog_item_option(text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item_option(text, text, text, text) from public, anon, authenticated;

grant execute on function public.add_catalog_item(text, text, text, text, integer) to authenticated;
grant execute on function public.delete_catalog_item(text, text) to authenticated;
grant execute on function public.update_catalog_item(text, text, text, text) to authenticated;
grant execute on function public.add_catalog_item_option(text, text, text, text) to authenticated;
grant execute on function public.delete_catalog_item_option(text, text, text) to authenticated;
grant execute on function public.update_catalog_item_option(text, text, text, text) to authenticated;

revoke all on function app_private.add_catalog_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item(text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item_option(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item_option(text, text, text) from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text) from public, anon, authenticated;

grant execute on function app_private.add_catalog_item(text, text, text, text, integer) to authenticated;
grant execute on function app_private.delete_catalog_item(text, text) to authenticated;
grant execute on function app_private.update_catalog_item(text, text, text, text) to authenticated;
grant execute on function app_private.add_catalog_item_option(text, text, text, text) to authenticated;
grant execute on function app_private.delete_catalog_item_option(text, text, text) to authenticated;
grant execute on function app_private.update_catalog_item_option(text, text, text, text) to authenticated;

do $$
begin
  if exists (
    select 1
    from public.menu_availability_overlays overlay
    where nullif(btrim(overlay.group_id), '') is not null
  ) then
    raise exception 'Availability overlays must not contain group_id values before removing the column.';
  end if;
end $$;

revoke all on function public.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;

drop function public.set_menu_availability_overlay(text, text, text, text, boolean);
drop function public.clear_menu_availability_overlay(text, text, text, text);
drop function public.menu_availability_target_exists(text, text, text, text);

revoke all on function app_private.menu_availability_target_exists(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_menu_availability_overlay(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.clear_menu_availability_overlay(text, text, text, text) from public, anon, authenticated;

drop function app_private.set_menu_availability_overlay(text, text, text, text, boolean);
drop function app_private.clear_menu_availability_overlay(text, text, text, text);
drop function app_private.menu_availability_target_exists(text, text, text, text);

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('app_private.get_admin_operational_state()'::regprocedure)
  into current_definition;

  updated_definition := replace(
    current_definition,
    E'      ''''::text as group_id,\n',
    ''
  );
  updated_definition := replace(
    updated_definition,
    E'          ''group_id'', target.group_id,\n',
    ''
  );
  updated_definition := replace(
    updated_definition,
    E'          ''group_id'', coalesce(overlay.group_id, ''''),\n',
    ''
  );
  updated_definition := replace(
    updated_definition,
    E'        order by overlay.menu_id, overlay.section_id, coalesce(overlay.group_id, ''''), overlay.item_id',
    E'        order by overlay.menu_id, overlay.section_id, overlay.item_id'
  );

  if current_definition = updated_definition
    or updated_definition like '%group_id%' then
    raise exception 'Could not remove group_id from app_private.get_admin_operational_state().';
  end if;

  execute updated_definition;
end $$;

drop index if exists public.menu_availability_overlays_unique_item;

alter table public.menu_availability_overlays
  drop column group_id;

create unique index menu_availability_overlays_unique_item
  on public.menu_availability_overlays (menu_id, section_id, item_id);

create or replace function app_private.menu_availability_target_exists(
  target_menu_id text,
  target_section_id text,
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
      and item.item_id = target_item_id
  )
  or exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_grill_catalog_items item
    where profile.id = target_menu_id
      and target_section_id = 'parrilla'
      and item.item_id = target_item_id
  )
  or exists (
    select 1
    from menu_content.menu_profiles profile
    cross join menu_content.menu_catalog_items item
    where profile.id = target_menu_id
      and item.section_id = target_section_id
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
      and item.item_id || '-' || option.option_id = target_item_id
  );
$$;

create or replace function app_private.set_menu_availability_overlay(
  menu_id text,
  section_id text,
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
  target_item_id text := set_menu_availability_overlay.item_id;
  target_available_override boolean := set_menu_availability_overlay.available_override;
  previous_override boolean;
  row_exists boolean;
  updated_count integer;
begin
  if target_available_override is null then
    return query select false, false, false, 'set_menu_availability_overlay', 'available_override_required';
    return;
  end if;

  if target_available_override is true then
    if not public.menu_availability_target_exists(
      target_menu_id,
      target_section_id,
      target_item_id
    ) then
      return query select false, false, false, 'set_menu_availability_overlay', 'invalid_availability_target';
      return;
    end if;

    if not public.can_edit_availability(target_menu_id) then
      return query select false, false, false, 'set_menu_availability_overlay', 'permission_denied';
      return;
    end if;

    delete from public.menu_availability_overlays overlay
    where overlay.menu_id = target_menu_id
      and overlay.section_id = target_section_id
      and overlay.item_id = target_item_id;

    if found then
      return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_cleared';
    else
      return query select true, false, false, 'set_menu_availability_overlay', 'availability_overlay_not_found';
    end if;
    return;
  end if;

  if not public.menu_availability_target_exists(
    target_menu_id,
    target_section_id,
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
    and overlay.item_id = target_item_id;

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    begin
      insert into public.menu_availability_overlays (
        menu_id,
        section_id,
        item_id,
        available_override,
        updated_at,
        updated_by
      )
      values (
        target_menu_id,
        target_section_id,
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
          and overlay.item_id = target_item_id;
    end;
  end if;

  return query select true, true, false, 'set_menu_availability_overlay', 'availability_overlay_updated';
end;
$$;

create or replace function app_private.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
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
  target_item_id text := clear_menu_availability_overlay.item_id;
  deleted_count integer;
begin
  if not public.menu_availability_target_exists(
    target_menu_id,
    target_section_id,
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
    and overlay.item_id = target_item_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    return query select true, false, false, 'clear_menu_availability_overlay', 'availability_overlay_not_found';
    return;
  end if;

  return query select true, true, false, 'clear_menu_availability_overlay', 'availability_overlay_cleared';
end;
$$;

create or replace function public.menu_availability_target_exists(
  target_menu_id text,
  target_section_id text,
  target_item_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public, app_private, pg_temp
as $$
  select app_private.menu_availability_target_exists($1, $2, $3);
$$;

create or replace function public.set_menu_availability_overlay(
  menu_id text,
  section_id text,
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
  select * from app_private.set_menu_availability_overlay($1, $2, $3, $4);
$$;

create or replace function public.clear_menu_availability_overlay(
  menu_id text,
  section_id text,
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
  select * from app_private.clear_menu_availability_overlay($1, $2, $3);
$$;

revoke all on public.menu_availability_overlays from anon, authenticated;
grant select (
  menu_id,
  section_id,
  item_id,
  available_override
) on public.menu_availability_overlays to anon, authenticated;

revoke all on function public.menu_availability_target_exists(text, text, text) from public, anon, authenticated;
revoke all on function public.set_menu_availability_overlay(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.clear_menu_availability_overlay(text, text, text) from public, anon, authenticated;

grant execute on function public.set_menu_availability_overlay(text, text, text, boolean) to authenticated;
grant execute on function public.clear_menu_availability_overlay(text, text, text) to authenticated;

revoke all on function app_private.menu_availability_target_exists(text, text, text) from public, anon, authenticated;
revoke all on function app_private.set_menu_availability_overlay(text, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.clear_menu_availability_overlay(text, text, text) from public, anon, authenticated;

grant execute on function app_private.menu_availability_target_exists(text, text, text) to authenticated;
grant execute on function app_private.set_menu_availability_overlay(text, text, text, boolean) to authenticated;
grant execute on function app_private.clear_menu_availability_overlay(text, text, text) to authenticated;

commit;
