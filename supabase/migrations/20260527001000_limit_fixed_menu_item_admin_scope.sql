begin;

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

  if target_section_id in ('minutas-tartas-omelettes', 'empanadas') then
    return query select false, false, true, 'add_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query
  select *
  from app_private.add_catalog_item($1, $2, $3, $4, $5, $6);
end;
$$;

create or replace function public.update_catalog_item(
  section_id text,
  group_id text,
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
declare
  target_section_id text := nullif(btrim(update_catalog_item.section_id), '');
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id in ('minutas-tartas-omelettes', 'empanadas') then
    return query select false, false, true, 'update_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query
  select *
  from app_private.update_catalog_item($1, $2, $3, $4, $5);
end;
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
language plpgsql
security invoker
set search_path = public, app_private, pg_temp
as $$
declare
  target_section_id text := nullif(btrim(delete_catalog_item.section_id), '');
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'delete_catalog_item', 'permission_denied';
    return;
  end if;

  if target_section_id in ('minutas-tartas-omelettes', 'empanadas') then
    return query select false, false, true, 'delete_catalog_item', 'catalog_item_locked';
    return;
  end if;

  return query
  select *
  from app_private.delete_catalog_item($1, $2, $3);
end;
$$;

revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.update_catalog_item(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_catalog_item(text, text, text) from public, anon, authenticated;

grant execute on function public.add_catalog_item(text, text, text, text, text, integer) to authenticated;
grant execute on function public.update_catalog_item(text, text, text, text, text) to authenticated;
grant execute on function public.delete_catalog_item(text, text, text) to authenticated;

commit;
