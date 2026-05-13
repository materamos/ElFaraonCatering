begin;

delete from public.menu_availability_overlays overlay
where overlay.section_id = 'menu-del-dia'
  and overlay.item_id in (
    'menu-del-dia-con-bebida',
    'menu-vegetariano-del-dia-con-bebida'
  );

delete from menu_content.menu_daily_items item
where item.item_id in (
  'menu-del-dia-con-bebida',
  'menu-vegetariano-del-dia-con-bebida'
);

update menu_content.menu_daily_items item
set order_index = 1
where item.item_id = 'menu-vegetariano-del-dia'
  and item.order_index is distinct from 1;

delete from menu_content.menu_prices price
where price.pricing_key in (
  'menu-del-dia-con-bebida',
  'menu-vegetariano-del-dia-con-bebida'
);

create or replace function public.set_daily_menu(
  regular_name text,
  regular_description text,
  regular_note text,
  regular_available boolean,
  vegetarian_name text,
  vegetarian_description text,
  vegetarian_note text,
  vegetarian_available boolean
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
  regular_note_value text := nullif(btrim(set_daily_menu.regular_note), '');
  vegetarian_name_value text := nullif(btrim(set_daily_menu.vegetarian_name), '');
  vegetarian_description_value text := nullif(btrim(set_daily_menu.vegetarian_description), '');
  vegetarian_note_value text := nullif(btrim(set_daily_menu.vegetarian_note), '');
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

  if regular_available is null or vegetarian_available is null then
    return query select false, false, true, 'set_daily_menu', 'daily_menu_available_required';
    return;
  end if;

  select count(*)
  into expected_item_count
  from menu_content.menu_daily_items item
  where item.item_id in (
    'menu-del-dia',
    'menu-vegetariano-del-dia'
  );

  if expected_item_count <> 2 then
    return query select false, false, true, 'set_daily_menu', 'daily_menu_model_incomplete';
    return;
  end if;

  with desired_items (
    item_id,
    name,
    description,
    note,
    available
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value, regular_available),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value, vegetarian_available)
  )
  select exists (
    select 1
    from desired_items desired
    join menu_content.menu_daily_items item
      on item.item_id = desired.item_id
    where item.name is distinct from desired.name
      or item.description is distinct from desired.description
      or item.note is distinct from desired.note
      or item.available is distinct from desired.available
  )
  into has_changes;

  if not has_changes then
    return query select true, false, true, 'set_daily_menu', 'daily_menu_unchanged';
    return;
  end if;

  with desired_items (
    item_id,
    name,
    description,
    note,
    available
  ) as (
    values
      ('menu-del-dia', regular_name_value, regular_description_value, regular_note_value, regular_available),
      ('menu-vegetariano-del-dia', vegetarian_name_value, vegetarian_description_value, vegetarian_note_value, vegetarian_available)
  )
  update menu_content.menu_daily_items item
  set
    name = desired.name,
    description = desired.description,
    note = desired.note,
    available = desired.available
  from desired_items desired
  where item.item_id = desired.item_id;

  return query select true, true, true, 'set_daily_menu', 'daily_menu_updated';
end;
$$;

revoke all on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.set_daily_menu(text, text, text, boolean, text, text, text, boolean) to authenticated;

commit;
