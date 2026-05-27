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

create or replace function app_private.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
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
  target_section_id text := nullif(btrim(update_catalog_item_option.section_id), '');
  target_group_id text := coalesce(nullif(btrim(update_catalog_item_option.group_id), ''), '');
  target_item_id text := nullif(btrim(update_catalog_item_option.item_id), '');
  target_option_id text := nullif(btrim(update_catalog_item_option.option_id), '');
  target_name text := nullif(btrim(update_catalog_item_option.name), '');
  target_description text := nullif(btrim(update_catalog_item_option.description), '');
  target_catalog_item_id bigint;
  current_name text;
  current_description text;
begin
  if not public.can_edit_menu_content() then
    return query select false, false, true, 'update_catalog_item_option', 'permission_denied';
    return;
  end if;

  if target_section_id is null or target_item_id is null or target_option_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_id_required';
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
    and item.group_id = target_group_id
    and item.item_id = target_item_id;

  if target_catalog_item_id is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_item_not_found';
    return;
  end if;

  select option.name, option.description
  into current_name, current_description
  from menu_content.menu_catalog_item_options option
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  if current_name is null then
    return query select false, false, true, 'update_catalog_item_option', 'catalog_option_not_found';
    return;
  end if;

  if current_name is not distinct from target_name
    and current_description is not distinct from target_description then
    return query select true, false, true, 'update_catalog_item_option', 'catalog_option_unchanged';
    return;
  end if;

  update menu_content.menu_catalog_item_options option
  set
    name = target_name,
    description = target_description
  where option.catalog_item_id = target_catalog_item_id
    and option.option_id = target_option_id;

  return query select true, true, true, 'update_catalog_item_option', 'catalog_option_updated';
end;
$$;

create or replace function public.update_catalog_item_option(
  section_id text,
  group_id text,
  item_id text,
  option_id text,
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
language sql
security invoker
set search_path = public, app_private, pg_temp
as $$
  select *
  from app_private.update_catalog_item_option($1, $2, $3, $4, $5, $6);
$$;

revoke all on function app_private.get_admin_catalog_editor_state() from public, anon, authenticated;
revoke all on function app_private.update_catalog_item_option(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_catalog_item_option(text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function app_private.get_admin_catalog_editor_state() to authenticated;
grant execute on function app_private.update_catalog_item_option(text, text, text, text, text, text) to authenticated;
grant execute on function public.update_catalog_item_option(text, text, text, text, text, text) to authenticated;

commit;
