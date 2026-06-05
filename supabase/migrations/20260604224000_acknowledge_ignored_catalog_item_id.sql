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
  ignored_item_id text := nullif(btrim(add_catalog_item.item_id), '');
begin
  -- Keep the legacy RPC parameter accepted while forcing server-generated IDs.
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
    $2,
    app_private.generate_admin_id('item'),
    $4,
    $5,
    $6
  );
end;
$$;

revoke all on function public.add_catalog_item(text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.add_catalog_item(text, text, text, text, text, integer) to authenticated;

commit;
