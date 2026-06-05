begin;

create or replace function app_private.generate_admin_id(prefix text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  clean_prefix text := nullif(btrim(generate_admin_id.prefix), '');
begin
  if clean_prefix is null or clean_prefix !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid admin id prefix';
  end if;

  return clean_prefix || '-' || left(replace(extensions.gen_random_uuid()::text, '-', ''), 12);
end;
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
language plpgsql
security invoker
set search_path = public, app_private, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(add_catalog_item.section_id), '');
begin
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
    $2,
    app_private.generate_admin_id('item'),
    $4,
    $5,
    $6
  );
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
  from app_private.add_catalog_item_option(
    $1,
    $2,
    $3,
    app_private.generate_admin_id('option'),
    $5
  );
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
  from app_private.add_grill_item(
    $1,
    app_private.generate_admin_id('grill-item'),
    $3,
    $4,
    $5
  );
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
  from app_private.add_grill_product(
    app_private.generate_admin_id('grill-product'),
    $2,
    app_private.generate_admin_id('grill-item'),
    $4,
    $5
  );
$$;

revoke all on function app_private.generate_admin_id(text) from public, anon, authenticated;
revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.add_catalog_item_option(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.add_grill_item(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.add_grill_product(text, text, text, text, integer) from public, anon, authenticated;

grant execute on function app_private.generate_admin_id(text) to authenticated;
grant execute on function public.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function public.add_catalog_item_option(text, text, text, text, text) to authenticated;
grant execute on function public.add_grill_item(text, text, text, text, integer) to authenticated;
grant execute on function public.add_grill_product(text, text, text, text, integer) to authenticated;

commit;
