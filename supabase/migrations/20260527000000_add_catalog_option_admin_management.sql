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
  existing_option_count integer;
  next_order_index integer;
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

  select item.id
  into target_catalog_item_id
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
      and option.option_id = target_option_id
  ) then
    return query select false, false, true, 'add_catalog_item_option', 'catalog_option_exists';
    return;
  end if;

  select coalesce(max(option.order_index), -1) + 1
  into next_order_index
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id;

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
  group_id text,
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
  target_group_id text := coalesce(nullif(btrim(delete_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(delete_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(delete_catalog_item_option.option_id), '');
  target_catalog_item_id bigint;
  existing_option_count integer;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'delete_catalog_item_option', 'catalog_option_id_required';
    return;
  end if;

  select item.id
  into target_catalog_item_id
  from menu_content.menu_catalog_items item
  where item.section_id = target_section_id
    and item.group_id = target_group_id
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

create or replace function public.add_catalog_item_option(
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
  from app_private.add_catalog_item_option($1, $2, $3, $4, $5);
$$;

create or replace function public.delete_catalog_item_option(
  section_id text,
  group_id text,
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
  select *
  from app_private.delete_catalog_item_option($1, $2, $3, $4);
$$;

revoke all on function public.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_catalog_item_option(text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.delete_catalog_item_option(text, text, text, text) from public, anon, authenticated;

grant execute on function public.add_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function public.delete_catalog_item_option(text, text, text, text) to authenticated;
grant execute on function app_private.add_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function app_private.delete_catalog_item_option(text, text, text, text) to authenticated;
